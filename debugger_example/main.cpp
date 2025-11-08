#include <iostream>
#include "search.h"
#include "camera.h"
using namespace std;
int main(int argc, char* argv[]) {
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
            //grayFrame = cv::imread("/home/smartcar/图传上位机/image/" + to_string(image_process_start_idx) + ".jpg");
            ReadImage();
        } catch (const cv::Exception& e) {
            continue;
        }
        //图像处理函数
        Search(); 
        //给图像上画边界点
        showFrame();
        //输出图片到文件夹中
        //const string outputPath = "/home/smartcar/output/" + to_string(image_process_start_idx) + ".jpg";
        OutputImage();
    }
    return 0;
}
