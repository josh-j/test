cmake_minimum_required(VERSION 3.19)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project (test)
add_executable(test main.cc declarative.h)

target_compile_features(test PUBLIC cxx_std_17)
