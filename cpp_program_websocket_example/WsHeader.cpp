#include "WsHeader.h"
#include <algorithm>
#include <arpa/inet.h>
#include <iostream>
#include <iomanip>
#include <bitset>
#include <vector>
WsHeader header;
WsHeader::WsHeader() : size(0) {
}

void WsHeader::pack(std::vector<uint8_t>& buffer) {
    std::vector<uint8_t> result;
    uint32_t networkSize = htonl(size);  
    uint8_t* sizeBytes = reinterpret_cast<uint8_t*>(&networkSize);
    for (int i = 0; i < 4; ++i) {
        result.push_back(sizeBytes[i]);
    
    //添加文本内容
    for (char c : content) {
        result.push_back(static_cast<uint8_t>(c));
    } 
    //添加传入的buffer内容
    result.insert(result.end(), buffer.begin(), buffer.end());  
    //如果总大小不是4字节对齐，进行填充
    size_t totalSize = result.size();
    size_t padding = (4 - (totalSize % 4)) % 4;
    for (size_t i = 0; i < padding; ++i) {
        result.push_back(0x00); //用0填充
    }
    buffer = std::move(result);
}
void WsHeader::clear() {
    content.clear();
    size = 0;
}

uint32_t WsHeader::getSize() const {
    return size;
}

std::string WsHeader::getContent() const {
    return content;
}