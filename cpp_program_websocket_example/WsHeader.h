#ifndef WSHEADER_H
#define WSHEADER_H

#include <vector>
#include <string>
#include <cstdint>
#include <type_traits>
#include <sstream>
#include <iostream>
#include <iomanip>
class WsHeader {
private:
    uint32_t size;

    template<typename T>
    std::string toString(const T& value) {
        if constexpr (std::is_same_v<T, std::string>) {
            return value;
        } else if constexpr (std::is_same_v<T, const char*>) {
            return std::string(value);
        } else if constexpr (std::is_floating_point_v<T>) {
            std::ostringstream oss;
            oss << value;
            return oss.str();
        } else {
            return std::to_string(value);
        }
    }

public:
    std::string content;
    WsHeader();
    
    //添加数据到内容中
    template<typename T>
    void push(const std::string& name, T param);
    
    //打包数据到buffer
    void pack(std::vector<uint8_t>& buffer);
    
    //清空内容
    void clear();
    
    //获取当前内容大小
    uint32_t getSize() const;
    
    //获取内容
    std::string getContent() const;
};

template<typename T>
void WsHeader::push(const std::string& name, T param) {
    content += "<" + name + ">" + toString(param) + "</" + name + ">";
    size = static_cast<uint32_t>(content.length());
}

#endif
extern WsHeader header;