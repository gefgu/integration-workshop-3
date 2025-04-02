#include <ESP32Servo.h>

#define SERVO_1_PIN 2
#define SERVO_2_PIN 4
#define SERVO_3_PIN 16
#define SERVO_4_PIN 17
#define VIBRACALL_PIN 19

#define BUFFER_SIZE 32

Servo servo1;
Servo servo2;
Servo servo3;
Servo servo4;

// Função para definir o duty cycle de um servo específico
void setServoDuty(int servoNum, int duty)
{
    // Garante que o duty cycle está dentro dos limites
    duty = constrain(duty, 0, 100);

    // Mapeia de 0-100% para o valor de pulso do servo (500-2400us é um range comum)
    int pulseWidth = map(duty, 0, 100, 500, 2400);

    // Aplica ao servo correto
    switch (servoNum)
    {
    case 1:
        servo1.writeMicroseconds(pulseWidth);
        break;
    case 2:
        servo2.writeMicroseconds(pulseWidth);
        break;
    case 3:
        servo3.writeMicroseconds(pulseWidth);
        break;
    case 4:
        servo4.writeMicroseconds(pulseWidth);
        break;
    }
}

void setup()
{
    pinMode(VIBRACALL_PIN, OUTPUT);
    Serial.begin(115200);
    servo1.attach(SERVO_1_PIN);
    servo2.attach(SERVO_2_PIN);
    servo3.attach(SERVO_3_PIN);
    servo4.attach(SERVO_4_PIN);

    // Inicia os motores na posicao default
    setServoDuty(SERVO_1_PIN, 0);
    setServoDuty(SERVO_2_PIN, 0);
    setServoDuty(SERVO_3_PIN, 0);
    setServoDuty(SERVO_4_PIN, 0);
}

void loop()
{
    if(Serial.available() > 0){
        char command =Serial.read();
        switch(command){
            case '1':
                setServoDuty(4,50);
                setServoDuty(1,0);
                digitalWrite(VIBRACALL_PIN, HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN, LOW);
                break;
            case '2':
                setServoDuty(1,50);
                setServoDuty(2,0);
                digitalWrite(VIBRACALL_PIN, HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN, LOW);
                break;
            case '3':
                setServoDuty(2,50);
                setServoDuty(3,0);
                digitalWrite(VIBRACALL_PIN, HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN, LOW);
                break;
            case '4':
                setServoDuty(3,50);
                setServoDuty(4,0);
                digitalWrite(VIBRACALL_PIN, HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN, LOW);
                break;
            case '5':
                setServoDuty(1,50);
                setServoDuty(2,50);
                setServoDuty(3,50);
                setServoDuty(4,50);
                break;
            case '6':
                digitalWrite(VIBRACALL_PIN,HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN,LOW);
                break;
            case '7':
                digitalWrite(VIBRACALL_PIN,HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN,LOW);
                delay(50);       
                digitalWrite(VIBRACALL_PIN,HIGH);
                delay(500);
                digitalWrite(VIBRACALL_PIN,LOW);
                break;
        }
    }
}                 

