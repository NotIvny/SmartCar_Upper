#include <iostream>
using namespace std;
int main(int argc, char* argv[]) {
    //上位机发送调试命令会传两个参数 startIndex 和 endIndex
    for (int i = 1; i < argc; i++) {
        string arg = argv[i];
        if (arg == "--startIndex" && i + 1 < argc) {
            image_process_start_idx = std::stoi(argv[i + 1]);
            i++;
        } else if (arg == "--endIndex" && i + 1 < argc) {
            image_process_end_idx = std::stoi(argv[i + 1]);
            i++;
        }
    }
    if (image_process_start_idx > image_process_end_idx) {
        cerr << "错误: 开始索引不能大于结束索引" << endl;
        exit(1);
    }
    for(;image_process_start_idx <= image_process_end_idx; image_process_start_idx++){
        try {
            //读取图片
            ReadImage();
        } catch (const cv::Exception& e) {
            continue;
        }
        //图像处理函数，和小车上运行的图像处理函数应该是一样的
        Search(); 
        //给图像上画边界点
        showFrame();
        //输出图片到文件夹中
        OutputImage();
    }
    return 0;
}