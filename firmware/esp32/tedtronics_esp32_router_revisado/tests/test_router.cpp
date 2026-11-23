#include "Arduino.h"
#include <cassert>
#include <iostream>
#include <sstream>
#include <algorithm>
#include <cstring>
#include <random>

FakeSerial Serial;
struct Hardware {
  int gpio[40] = {};
  int modes[40] = {};
  uint8_t shiftU5 = 0,shiftU6=0,outU5=0,outU6=0;
  bool selected[2][16][8] = {};
  int resets = 0;
  int writes = 0;
  int unknownWrites=0;
  bool strobe = false;
  bool reset = true;
  bool oe = true;
  static bool negated(int pin) {return pin==23||pin==18||pin==22||pin==19||pin==21||pin==25;}
  int signal(int pin) const {return negated(pin) ? !gpio[pin]:gpio[pin];}
  void write(int pin,int value){
    int oldSCK=signal(18),oldRCK=signal(22),oldSTB=signal(19),oldRST=signal(25);
    gpio[pin]=value;
    int newSCK=signal(18),newRCK=signal(22),newSTB=signal(19),newRST=signal(25);
    if (!oldRST && newRST) {
      std::memset(selected,0,sizeof(selected));resets++;reset=true;
    }
    if (oldRST && !newRST) reset=false;
    if (!oldSCK && newSCK){
      uint8_t out=(shiftU5>>7)&1U;
      shiftU5=uint8_t((shiftU5<<1)|(signal(23)&1));
      shiftU6=uint8_t((shiftU6<<1)|out);
    }
    if (!oldRCK && newRCK){outU5=shiftU5;outU6=shiftU6;}
    if (oldSTB && !newSTB) {
      uint8_t cs=outU6 & 0x03;
      if (reset) return;
      if ((cs==1 || cs==2) && signal(21)==0){
        uint8_t placa=cs==1?0:1;
        uint8_t x=outU5&0x0f,y=(outU5>>4)&0x07;
        selected[placa][x][y]=(outU5&0x80)!=0;
        writes++;
      } else if (cs != 0){ unknownWrites++;}
    }
  }
  int cnt(int placa) const {
    int c=0;
    for(int x=0;x<16;x++)for(int y=0;y<8;y++)c+=selected[placa][x][y];
    return c;
  }
  void expect(int placa,std::initializer_list<std::pair<int,int>> crosspoints){
    bool expected[16][8]={};
    for (auto xy:crosspoints) expected[xy.first][xy.second]=true;
    for(int x=0;x<16;x++)for(int y=0;y<8;y++){
      if(selected[placa][x][y]!=expected[x][y]){
        std::cerr<<"MISMATCH placa="<<placa<<" x="<<x<<" y="<<y<<" real="<<selected[placa][x][y]<<"\n";
        std::abort();
      }
    }
  }
} hw;
void pinMode(uint8_t g,int m){hw.modes[g]=m;}
void digitalWrite(uint8_t g,int v){hw.write(g,v);}
void delay(int){}
void delayMicroseconds(int){}
#include "../tedtronics_esp32_router_revisado.ino"
void command(const std::string& c){
  for(char ch:c)Serial.input.push_back(ch);
  Serial.input.push_back('\n');
  loop();
  if(!Serial.input.empty()) std::abort();
}

int main(){
  setup();
  assert(hw.reset && hw.cnt(0)==0 && hw.cnt(1)==0);
  assert(hw.gpio[14]==0&&hw.gpio[26]==0&&hw.gpio[27]==0);
  assert(hw.modes[14]==OUTPUT&&hw.modes[26]==OUTPUT&&hw.modes[27]==OUTPUT);
  command("CONNECT 0 5");
  assert(!hw.reset);
  hw.expect(0,{{0,5},{5,5}});hw.expect(1,{});
  command("CONNECT 5 7");
  hw.expect(0,{{0,5},{5,5},{7,5}});
  command("CONNECT 11 12");
  hw.expect(0,{{0,5},{5,5},{7,5}});hw.expect(1,{{0,5},{1,5}});
  command("CONNECT 2 3");
  command("CONNECT 1 4");
  hw.expect(0,{{0,5},{5,5},{7,5},{1,6},{4,6},{2,7},{3,7}});
  command("CONNECT 8 9"); // limit 3 groups A
  hw.expect(0,{{0,5},{5,5},{7,5},{1,6},{4,6},{2,7},{3,7}});
  command("CONNECT 3 17"); // cross board blocked
  assert(hw.cnt(1)==2);
  command("DISCONNECT 0 5");
  hw.expect(0,{{1,5},{4,5},{2,6},{3,6},{5,7},{7,7}});
  command("ISOLATE NODE07");
  hw.expect(0,{{1,5},{4,5},{2,6},{3,6}});
  command("MAP");
  assert(Serial.output.find("NODE01 -> U1 X1 Y5")!=std::string::npos);
  command("RESET");
  assert(hw.reset);hw.expect(0,{});hw.expect(1,{});
  command("CONNECT 0 5");
  command("CONNECT 5 7");
  command("CONNECT 0 7");
  command("DISCONNECT 0 5"); // cycle still connected
  hw.expect(0,{{0,5},{5,5},{7,5}});
  command("ISOLATE 5");
  hw.expect(0,{{0,5},{7,5}});
  command("REAPPLY");
  hw.expect(0,{{0,5},{7,5}});
  command("CONNECT 0 22"); // invalid
  hw.expect(0,{{0,5},{7,5}});
  command("CONNECT 2 02"); // second group
  hw.expect(0,{{0,5},{7,5}}); // mesmo node: rejeitado
  command("STOP");
  assert(hw.reset && hw.cnt(0)==0 && hw.cnt(1)==0);
  assert(hw.unknownWrites==0);
  // Teste de propriedade: em toda operacao aleatoria, a memoria simulada
  // dos dois MT8816 deve coincidir com o plano construido em RAM.
  std::mt19937 rng(12345);
  for (int i=0;i<400;i++) {
    int a = int(rng()%22), b = int(rng()%22);
    int op = int(rng()%6);
    if (op==0) command("RESET");
    else if (op==1) command("ISOLATE " + std::to_string(a));
    else if (op==2) command("DISCONNECT " + std::to_string(a) + " " + std::to_string(b));
    else if (op==3) command("REAPPLY");
    else command("CONNECT " + std::to_string(a) + " " + std::to_string(b));
    Ted::Plano expected;
    assert(Ted::montarPlano(expected));
    bool algum = false;
    for (int n=0;n<22;n++) {
      int placa=n/11,x=n%11;
      for(int y=0;y<8;y++) {
        bool esperado=(y>=5 && expected.barramento[n]==y);
        assert(hw.selected[placa][x][y]==esperado);
        algum = algum || esperado;
      }
    }
    assert(hw.reset == !algum);
    assert(hw.gpio[14]==0&&hw.gpio[26]==0&&hw.gpio[27]==0);
    assert(hw.unknownWrites==0);
    if (i % 20 == 0) Serial.output.clear();
  }
  std::cout<<"OK tests, writes="<<hw.writes<<" resets="<<hw.resets<<"\n";
}
