const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');
const { timeStamp } = require('console');
const exePath = '/home/smartcar/上位机_调试部分/build/project'
var img_idx = 0;
let ws3000_flag = false
// 创建WebSocket服务器，监听3000端口（用于接收图片和按键信息）
const wss_receive = new WebSocket.Server({ port: 3000 });
console.log('WebSocket服务器已启动，正在监听3000端口（接收图片和按键信息）');

// 创建WebSocket服务器，监听3001端口（用于发送图片和接收按键信息）
const wss_send = new WebSocket.Server({ port: 3001 });
console.log('WebSocket服务器已启动，正在监听3001端口（发送图片和接收按键信息）');
// 确保目录存在
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// 初始化目录
ensureDirectoryExists('./image');
ensureDirectoryExists('./data');

// 解析二进制消息
function parseBinaryMessage(message) {
    try {
        // 读取前4字节作为header size（大端序）
        if (message.length < 4) {
            throw new Error('消息长度不足，无法读取header');
        }
        console.log("数据总长度：" + message.length)
        const sizeBuffer = message.slice(0, 4);
        let binaryString = '';
        for (let i = 0; i < sizeBuffer.length; i++) {
            binaryString += sizeBuffer[i].toString(2).padStart(8, '0') + ' ';
        }
        console.log(`sizeBuffer (binary): ${binaryString}`);
        const textSize = sizeBuffer.readUInt32BE(0);
        
        console.log(`文本内容大小: ${textSize} 字节`);

        // 读取文本内容
        if (message.length < 4 + textSize) {
            throw new Error('消息长度不足，无法读取完整文本内容');
        }

        const textBuffer = message.slice(4, 4 + textSize);
        const textContent = textBuffer.toString('utf8');
        
        console.log(`文本内容: ${textContent}`);

        // 剩余部分是图片数据
        const imageData = message.slice(4 + textSize);
        
        return {
            textSize,
            textContent,
            imageData
        };
    } catch (error) {
        console.error('解析二进制消息失败:', error);
        return null;
    }
}

// 从XML文本中提取name: param对
function extractParamsFromXml(xmlText) {
    const params = {};
    const regex = /<([^>]+)>([^<]*)<\/\1>/g;
    let match;
    
    while ((match = regex.exec(xmlText)) !== null) {
        const name = match[1];
        const param = match[2];
        params[name] = param;
    }
    
    return params;
}

// 保存参数到txt文件
function saveParamsToFile(params, filePath) {
    try {
        let content = '';
        for (const [name, value] of Object.entries(params)) {
            content += `${name}: ${value}\n`;
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`参数已保存到: ${filePath}`);
        return true;
    } catch (error) {
        console.error('保存参数文件失败:', error);
        return false;
    }
}
function readParamsFromFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`参数文件不存在: ${filePath}`);
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const params = {};
        
        for (const line of lines) {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex !== -1) {
                const name = line.substring(0, separatorIndex).trim();
                const value = line.substring(separatorIndex + 1).trim();
                params[name] = value;
            }
        }
        
        console.log(`从文件读取参数成功: ${filePath}`);
        return params;
    } catch (error) {
        console.error('读取参数文件失败:', error);
        return null;
    }
}

/**
 * 读取图像文件并转换为buffer
 * @param {string} imageFilePath - 图像文件路径
 * @returns {Buffer|null} 图像buffer，失败返回null
 */
function readImageToBuffer(imageFilePath) {
    try {
        if (!fs.existsSync(imageFilePath)) {
            console.error(`图像文件不存在: ${imageFilePath}`);
            return null;
        }
        
        const imageBuffer = fs.readFileSync(imageFilePath);
        console.log(`图像读取成功: ${imageFilePath}, 大小: ${imageBuffer.length} 字节`);
        return imageBuffer;
    } catch (error) {
        console.error('读取图像文件失败:', error);
        return null;
    }
}
// 当有新的客户端连接到3000端口时触发
let _ws = null
wss_receive.on('connection', (ws) => {
    _ws = ws
    ws3000_flag = true
    console.log('新的客户端已连接到3000端口');

    // 当接收到客户端消息时触发
    ws.on('message', (message) => {
        console.log('接收到消息');
    
        // 检查消息是否为二进制数据（Buffer）
        if (message instanceof Buffer) {
            console.log('接收到二进制数据，开始解析...');
            
            // 解析二进制消息
            const parsedData = parseBinaryMessage(message);
            
            if (!parsedData) {
                console.error('解析二进制数据失败');
                return;
            }
    
            // 提取参数
            const params = extractParamsFromXml(parsedData.textContent);
            console.log('提取的参数:', params);
    
            // 定义文件路径
            const txtFilePath = `./data/${img_idx}.txt`;
            const imageFilePath = `./image/${img_idx}.jpg`;
            img_idx++;
            // 先保存参数到txt文件
            if (saveParamsToFile(params, txtFilePath)) {
                // 然后保存图片
                if (parsedData.imageData.length > 0) {
                    fs.writeFile(imageFilePath, parsedData.imageData, (err) => {
                        if (err) {
                            console.error('保存图片失败:', err);
                        } else {
                            console.log(`图片已保存为: ${imageFilePath}`);
    
                            //通知所有连接到3001端口的客户端有新图片
                            wss_send.clients.forEach((client) => {
                                if (client.readyState === WebSocket.OPEN) {
                                    client.send(JSON.stringify({ 
                                        type: 'new_image', 
                                        image: parsedData.imageData,
                                        idx: img_idx - 1,
                                        params: params  // 同时发送参数信息
                                    }));
                                }
                            });
    
                        }
                    });
                } else {
                    console.log('没有图片数据，仅保存参数文件');
                    
                    // // 通知客户端（即使没有图片）
                    // wss_send.clients.forEach((client) => {
                    //     if (client.readyState === WebSocket.OPEN) {
                    //         client.send(JSON.stringify({ 
                    //             type: 'new_data', 
                    //             idx: img_idx,
                    //             params: params
                    //         }));
                    //     }
                    // });
                    
                    img_idx++;
                }
            }
        } else {
            // 处理文本数据
            console.log(`接收到文本消息: ${message}`);
            ws.send(JSON.stringify({
                type: 'message', 
                message: `服务器已收到消息: ${message}`
            }));
        }
    });

    // 当客户端断开连接时触发
    ws.on('close', () => {
        ws3000_flag = false
        _ws = null
        console.log('客户端已断开连接');
    });
});

// 当有新的客户端连接到3001端口时触发
wss_send.on('connection', (ws) => {
    console.log('新的客户端已连接到3001端口');

    // 向客户端发送最新的图片索引
    //ws.send(JSON.stringify({ type: 'current_image', idx: img_idx - 1 }));

    // 当接收到客户端消息时触发
    ws.on('message', (message) => {
        console.log('接收到消息');

        // 处理文本数据
        const data = JSON.parse(message);
        if (data.type === 'debug'){ 
            if(data.endIndex < data.startIndex || data.origin){
                data.endIndex = data.startIndex
                const txtFilePath = `./data/${data.startIndex}.txt`;
                const imageFilePath = data.origin ? `./image/${data.startIndex}.jpg`: `../output/${data.startIndex}.jpg`;
                const params = readParamsFromFile(txtFilePath);
                const imageBuffer = readImageToBuffer(imageFilePath);
                if(data.no_idx_return){
                    data.startIndex = -1
                }
                wss_send.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'new_image', 
                            image: imageBuffer,
                            idx: data.startIndex,
                            params: params  // 同时发送参数信息
                        }));
                    }
                });
                return;
            }
            const command = `"${exePath}" --startIndex ${data.startIndex} --endIndex ${data.endIndex}`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('执行错误:', error);
                    ws.send(JSON.stringify({type: 'debug_info', message: `执行错误：${error}`}));
                    return;
                }
                if (stderr) {
                    console.error('错误输出:', stderr);
                    ws.send(JSON.stringify({type: 'debug_info', message: `错误输出：${error}`}));
                    return;
                }
                ws.send(JSON.stringify({type: 'debug_info', message: stdout.length > 200 ? stdout.substring(0, 200) + '...' : stdout}));
                const txtFilePath = `./data/${data.startIndex}.txt`;
                const imageFilePath = `../output/${data.startIndex}.jpg`;
                const params = readParamsFromFile(txtFilePath);
                const imageBuffer = readImageToBuffer(imageFilePath);
                if(data.no_idx_return){
                    data.startIndex = -1
                }
                wss_send.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'new_image', 
                            image: imageBuffer,
                            idx: data.startIndex,
                            params: params  // 同时发送参数信息
                        }));
                    }
                });
                
            });
        } else if(data.type === 'heartbeat'){
            ws.send(JSON.stringify({type: 'heartbeat_response', status: ws3000_flag}))
        } else if(data.type === 'start'){
            if(_ws != null){
                _ws.send(data.frameRate);
            }
        } else {
            console.log(`接收到文本消息: ${message}`);
            ws.send(JSON.stringify({type: 'message', message: `服务器已收到消息: ${message}`}));
        } 
    });

    // 当客户端断开连接时触发
    ws.on('close', () => {
        console.log('客户端已断开连接');
    });
});

// 创建HTTP服务器，用于提供HTML页面
const server = http.createServer((req, res) => {
    if (req.url === '/') {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(8080, () => {
    console.log('HTTP服务器已启动，正在监听8080端口');
});