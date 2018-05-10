#ifndef __PC_INCLUDED__
#define __PC_INCLUDED__


#include <map>
#include <boost/asio.hpp>

typedef std::map<int, std::string> Peers;

class PCClientObserver {
public:
  virtual void OnSignedIn() = 0;  // Called when we're logged on.
  virtual void OnDisconnected() = 0;
  virtual void OnPeerConnected(std::string id, const std::string& name) = 0;
  virtual void OnPeerDisconnected(std::string peer_id) = 0;
  virtual void OnMessageFromPeer(std::string peer_id, const std::string& message) = 0;
  virtual void OnMessageSent(int err) = 0;
  virtual ~PCClientObserver() {}
};

class PC {
 public:
  enum State {
    NOT_CONNECTED,
    SIGNING_IN,
    CONNECTED,
    SIGNING_OUT_WAITING,
    SIGNING_OUT
  };

  PC(const std::string &name);
  ~PC();

  std::string id() const;
  bool is_connected() const;
  const Peers& peers() const;

  void RegisterObserver(PCClientObserver* callback);

  bool Connect(const std::string& client_name);

  bool SendToPeer(std::string peer_id, const std::string& message);
  bool SendHangUp(std::string peer_id);
  bool IsSendingMessage();

  bool SignOut();
  void OnHangingGetRead();
  void OnHangingGetConnect();

 protected:
  void Close();
  bool ConnectControlSocket();
  boost::asio::ip::tcp::socket* CreateClientSocket(int port);
  void OnMessageFromPeer(std::string peer_id, const std::string& message);

  // Returns true if the whole response has been read.
  bool ReadIntoBuffer(boost::asio::ip::tcp::socket* socket, std::string* data,
                      size_t* content_length);
  void OnRead(boost::asio::ip::tcp::socket* socket);
  void parseMessage(std::string *data);


  void OnClose(boost::asio::ip::tcp::socket* socket, int err);

  PCClientObserver* callback_;
  std::string server_address_;

  boost::asio::ip::tcp::socket* control_socket_;
  boost::asio::ip::tcp::resolver* resolver_;
  boost::asio::io_service* ioservice_;

  std::string onconnect_data_;
  std::string control_data_;
  std::string notification_data_;
  Peers peers_;
  State state_;
  std::string my_id_;
  bool isSending;
};


#endif
