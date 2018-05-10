#include <OneToManyProcessor.h>
#include <WebRtcConnection.h>

#include <vector>

using erizo::ExtMap;
using erizo::IceConfig;
using erizo::RtpMap;
using erizo::WebRtcConnection;

class SDPReceiver {

public:

	SDPReceiver();
	virtual ~SDPReceiver() {
	}
	;
	bool createPublisher(std::string peer_id);
	bool createSubscriber(std::string peer_id);
	void setRemoteSDP(std::string peer_id, const std::string &sdp);
	std::string getLocalSDP(std::string peer_id);
	void peerDisconnected(std::string peer_id);

private:

	uint32_t index;
	erizo::OneToManyProcessor* muxer;
	IceConfig ice_config;
	std::vector<RtpMap> rtp_maps;
	std::vector<ExtMap> ext_maps;
	std::shared_ptr<erizo::Transport> transport;
	std::shared_ptr<WebRtcConnection> connection;
	std::shared_ptr<erizo::SimulatedClock> simulated_clock;
	std::shared_ptr<erizo::SimulatedWorker> simulated_worker;
	std::shared_ptr<erizo::IOWorker> io_worker;
};
