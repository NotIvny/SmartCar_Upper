#!/bin/bash

echo "================================"
echo "      图片转视频工具"
echo "================================"

read -p "请输入起始编号(a): " start_num
read -p "请输入结束编号(b): " end_num

echo
echo "步骤1: 检查图片序列..."
echo

current=$start_num
created=0

while [ $current -le $end_num ]; do
    if [ ! -f "image/${current}.jpg" ]; then
        prev=$((current - 1))
        if [ -f "image/${prev}.jpg" ]; then
            echo "创建图片: image/${current}.jpg"
            cp "image/${prev}.jpg" "image/${current}.jpg"
            created=$((created + 1))
        fi
    fi
    current=$((current + 1))
done

echo
echo "步骤2: 生成视频..."
echo

total_frames=$((end_num - start_num + 1))
ffmpeg -r 30 -start_number $start_num -i "image/%d.jpg" -vframes $total_frames -threads 4 -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" output.mp4

if [ $? -eq 0 ]; then
    echo
    echo "处理完成!"
    echo "补全图片: $created 张"
    echo "生成视频: output.mp4"
    echo "总帧数: $total_frames 帧"
else
    echo "视频生成失败!"
fi

read -p "按回车键继续..."
