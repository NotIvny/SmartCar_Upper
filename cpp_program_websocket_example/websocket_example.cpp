#include <iostream>
#include <atomic>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <stdlib.h>
#include "zf_common_headfile.h"
#include "WsHeader.h"
namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;
net::io_context ioc;
tcp::resolver resolver(ioc);
websocket::stream<tcp::socket> ws(ioc);
string cnnt = "";
int key_press_count = 0;
int fps_factor = 10;
std::atomic<bool> running{true};
//线程安全的队列模板
template <typename T>
class ThreadSafeQueue
{
public:
    void push(const T &value)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.push(value);
        cond_.notify_one();
    }

    bool wait_and_pop(T &value, const std::function<bool()> &stop_condition)
    {
        std::unique_lock<std::mutex> lock(mutex_);
        cond_.wait(lock, [&]
                   { return !queue_.empty() || stop_condition(); });
        if (stop_condition())
            return false;
        value = queue_.front();
        queue_.pop();
        return true;
    }

private:
    mutable std::mutex mutex_;
    std::queue<T> queue_;
    std::condition_variable cond_;
};
void doWithWSMessage(int message){
    if(message > 0 && message <= 60){ //发车
        //这里需要补充发车标志为1
        fps_factor = 60 / message;
    }else if(message == 0){ //停车
        //这里有安全危险，请自行调整为停车标志置为1，不要用exit(0)
        exit(0);
    }
}

// 图像采集线程
void mainThread(ThreadSafeQueue<std::vector<uchar>> &queue, std::atomic<bool> &running, std::atomic<int> &message)
{
    int loop_cnt = 0;
    while (!CameraInit())
    {
        cout << "failed to init camera" << endl;
    }
    while (running)
    {
        //在这里写小车的运行逻辑
        //这里传入调试参数
        header.push("IMAGE_MIDDLE", IMAGE_MIDDLE);
        // header.push("loca", "a");
        // 抽帧图传，当然也可以不抽帧
        if (camera_image_index % fps_factor == 1 && ws_send_type == 2 && !grayFrame.empty()) {
            std::vector<uchar> buffer;
            cv::imencode(".jpg", grayFrame, buffer);
            header.pack(buffer);
            queue.push(buffer);
        }
        header.content.clear();
    }
}

// WebSocket发送线程
void sendThread(ThreadSafeQueue<std::vector<uchar>> &queue, std::atomic<bool> &running)
{
    try
    {

        std::vector<uchar> buffer;
        // 建立WebSocket连接
        auto const results = resolver.resolve(upper_ip, "3000");
        net::connect(::ws.next_layer(), results.begin(), results.end());
        ::ws.handshake(upper_ip + ":3000", "/");

        // 处理图像发送
        while (true)
        {
            if (!queue.wait_and_pop(buffer, [&]
                                    { return !running.load(); }))
                break;
            // 发送二进制数据
            ::ws.binary(true);
            ::ws.write(net::buffer(buffer.data(), buffer.size()));
        }

        // 关闭连接
        ::ws.close(websocket::close_code::normal);
    }
    catch (const std::exception &e)
    {
        std::cerr << "WebSocket错误: " << e.what() << std::endl;
    }
}
void receiveThread(std::atomic<int> &message)
{
    try
    {
        while (true)
        {
            if (!::ws.is_open())
            {
                // 如果没有连接，休眠 1 秒
                std::this_thread::sleep_for(std::chrono::seconds(1));
                continue;
            }

            beast::flat_buffer buffer_receive;
            ::ws.read(buffer_receive); // 阻塞等待接收消息

            // 将接收到的消息转换为字符串
            string new_message = beast::buffers_to_string(buffer_receive.data());
            cnnt = new_message;
            cout << "received: " << new_message << endl;
            try
            {
                message = atoi(new_message.c_str());
            }
            catch (...)
            {
                continue;
            }
            doWithWSMessage(message);
        }
    }
    catch (...)
    {
        cout << "cannot open receiveThread" << endl;
    }
}
int main()
{
    //发车按钮
    while(gpio_get_level(KEY_BEGIN) == 1){}
    ThreadSafeQueue<std::vector<uchar>> frameQueue;
    std::atomic<int> message{0};
    std::thread main_thread(mainThread, std::ref(frameQueue), std::ref(running), std::ref(message));
    std::thread send_thread(sendThread, std::ref(frameQueue), std::ref(running));
    std::thread receive_thread(receiveThread, std::ref(message));
    while (running)
    {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    running = false;
    // 等待线程结束
    main_thread.join();
    send_thread.join();
    receive_thread.join();
    return 0;
}