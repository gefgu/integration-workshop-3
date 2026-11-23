#pragma once
#include <cstdint>
#include <cstddef>
#include <string>
#include <deque>
#include <type_traits>
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define INPUT 0
#define F(x) x
void pinMode(uint8_t gpio,int mode);
void digitalWrite(uint8_t gpio,int value);
void delay(int ms);
void delayMicroseconds(int us);
struct FakeSerial {
  std::deque<char> input;
  std::string output;
  void begin(uint32_t) {}
  int available() {return int(input.size());}
  int read() {int n=input.front();input.pop_front();return n;}
  void print(const char* s){output+=s;}
  void print(char c){output+=c;}
  void print(int n){output+=std::to_string(n);}
  void print(unsigned int n){output+=std::to_string(n);}
  void print(long n){output+=std::to_string(n);}
  void println(){output+='\n';}
  template<typename T> void println(T x){print(x);println();}
};
extern FakeSerial Serial;
