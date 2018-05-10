/*
 * hsam.cpp
 */

#include <stdio.h>

#include <OneToManyProcessor.h>
#include <SdpInfo.h>
#include <WebRtcConnection.h>
#include <LibNiceConnection.h>
#include "Test.h"
#include "pc/Observer.h"

using namespace erizo;

std::string publisherid = "";
int main() {

//	new Test();

	SDPReceiver* receiver = new SDPReceiver();
	Observer *subscriber = new Observer("subscriber", receiver);
	new Observer("publisher", receiver);
	subscriber->wait();
	return 0;
}

class MockPublisher: public erizo::MediaSource, public erizo::FeedbackSink {
public:
	MockPublisher() {
		video_source_ssrc_list_[0] = 1;
		audio_source_ssrc_ = 2;
		source_fb_sink_ = this;
	}
	~MockPublisher() {
	}
	void close() override {
	}
	int sendPLI() override {
		return 0;
	}
	int deliverFeedback_(std::shared_ptr<DataPacket> data_packet) override {
		return 0;
	}
};

class MockSubscriber: public erizo::MediaSink, public erizo::FeedbackSource {
public:
	MockSubscriber() {
		sink_fb_source_ = this;
	}
	~MockSubscriber() {
	}
	void close() override {
	}
	int deliverAudioData_(std::shared_ptr<DataPacket> packet) override {
		return 0; //internalDeliverAudioData_(packet);
	}
	int deliverVideoData_(std::shared_ptr<DataPacket> packet) override {
		return 0; //internalDeliverVideoData_(packet);
	}
	int deliverEvent_(MediaEventPtr event) override {
		return 0; //internalDeliverEvent_(event);
	}

};

class MockTransport: public Transport {
public:
	MockTransport(std::string connection_id, bool bundle,
			const IceConfig &ice_config, std::shared_ptr<Worker> worker,
			std::shared_ptr<IOWorker> io_worker) :
			Transport(VIDEO_TYPE, "video", connection_id, bundle, true,
					std::shared_ptr<erizo::TransportListener>(nullptr),
					ice_config, worker, io_worker) {
	}

	virtual ~MockTransport() {
	}

	void updateIceState(IceState state, IceConnection *conn) override {
	}
	void onIceData(packetPtr packet) override {
	}
	void onCandidate(const CandidateInfo &candidate, IceConnection *conn)
			override {
	}
	void write(char* data, int len) override {
	}
	void processLocalSdp(SdpInfo *localSdp_) override {
	}
	void start() override {
	}
	void close() override {
	}
};

SDPReceiver::SDPReceiver() {
	muxer = new erizo::OneToManyProcessor();
}

bool SDPReceiver::createPublisher(std::string peer_id) {
	if (muxer->publisher == NULL) {
		printf("Adding publisher peer_id %s\n", peer_id.data());
		simulated_clock = std::make_shared<erizo::SimulatedClock>();
		simulated_worker = std::make_shared<erizo::SimulatedWorker>(
				simulated_clock);
		simulated_worker->start();
		io_worker = std::make_shared<erizo::IOWorker>();
		io_worker->start();
		connection = std::make_shared<WebRtcConnection>(simulated_worker,
				io_worker, "test_connection", ice_config, rtp_maps, ext_maps,
				nullptr);
		transport = std::make_shared<MockTransport>("test_connection", true,
				ice_config, simulated_worker, io_worker);
		connection->setTransport(transport);
		connection->updateState(TRANSPORT_READY, transport.get());

		std::shared_ptr<MockPublisher> publisher = publisher = std::make_shared<
				MockPublisher>();
		muxer->setPublisher(publisher);
		////////////////////////////
		//WebRtcConnection *newConn = new WebRtcConnection;
		//newConn->init();
		//newConn->setAudioReceiver(muxer);
		//newConn->setVideoReceiver(muxer);
		//muxer->setPublisher(newConn);
		////////////////////////////////
		publisherid = peer_id;
	} else {
		printf("PUBLISHER ALREADY SET\n");
		return false;
	}
	return true;
}
bool SDPReceiver::createSubscriber(std::string peer_id) {
	printf("Adding Subscriber peerid %s\n", peer_id.data());
	if (muxer->subscribers.find(peer_id) != muxer->subscribers.end()) {
		printf("OFFER AGAIN\n");
		return false;
	}

	//WebRtcConnection *newConn = new WebRtcConnection;
	//newConn->init();
	std::shared_ptr<MockSubscriber> subscriber =
			std::make_shared<MockSubscriber>();
	muxer->addSubscriber(subscriber, peer_id);
	return true;
}
void SDPReceiver::setRemoteSDP(std::string peer_id, const std::string &sdp) {
	if (peer_id == publisherid) {
		connection->setRemoteSdp(sdp, peer_id);
		//muxer->publisher->setRemoteSdp(sdp);

	} else {
		//muxer->subscribers[peer_id]->setRemoteSdp(sdp);
	}
}
std::string SDPReceiver::getLocalSDP(std::string peer_id) {
	std::string sdp;
	if (peer_id == publisherid) {
		sdp = connection->getLocalSdp();
	} else {
		//sdp = muxer->subscribers[peer_id]->getLocalSdp();
	}
	printf("Getting localSDP %s\n", sdp.c_str());
	return sdp;
}
void SDPReceiver::peerDisconnected(std::string peer_id) {
	if (peer_id != publisherid) {
		printf("removing peer %s\n", peer_id.data());
		muxer->removeSubscriber(peer_id);
	}
}

