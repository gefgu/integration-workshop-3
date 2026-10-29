/**
 * Bluetooth LE link to a real bench: frames are written to RX and arrive as TX notifications.
 * Needs a development build (`npx expo run:android`), not Expo Go.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import { BENCH_BLE } from '../../../protocol/bench.ts';
import { base64ToUtf8, utf8ToBase64 } from './base64.ts';
import type { BenchTransport } from './benchClient.ts';

let manager: BleManager | null = null;
const ble = () => {
  manager ??= new BleManager();
  return manager;
};

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // Android 12+ has the Bluetooth runtime permissions; older versions only know location for scans.
  const result = await PermissionsAndroid.requestMultiple(
    Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]
  );
  return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

/** Lists benches advertising the TedTronics service for `seconds`. */
export async function scanBenches(onFound: (device: Device) => void, seconds = 8): Promise<void> {
  if (!(await requestBlePermissions())) throw new Error('Permita o uso do Bluetooth para encontrar a bancada.');
  const seen = new Set<string>();
  ble().startDeviceScan([BENCH_BLE.service], null, (error, device) => {
    if (error || !device || seen.has(device.id)) return;
    seen.add(device.id);
    onFound(device);
  });
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  ble().stopDeviceScan();
}

export class BleTransport implements BenchTransport {
  private device: Device | null = null;
  private monitor: Subscription | null = null;
  private disconnect: Subscription | null = null;
  private frameListeners: ((frame: string) => void)[] = [];
  private closeListeners: (() => void)[] = [];

  constructor(
    private deviceId: string,
    private name: string
  ) {}

  get label(): string {
    return this.name;
  }

  async connect(): Promise<void> {
    ble().stopDeviceScan();
    let device = await ble().connectToDevice(this.deviceId);
    if (Platform.OS === 'android') device = await device.requestMTU(185);
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;
    this.monitor = device.monitorCharacteristicForService(BENCH_BLE.service, BENCH_BLE.tx, (error, characteristic) => {
      if (error || !characteristic?.value) return;
      const frame = base64ToUtf8(characteristic.value);
      for (const listener of this.frameListeners) listener(frame);
    });
    this.disconnect = ble().onDeviceDisconnected(this.deviceId, () => {
      this.device = null;
      for (const listener of this.closeListeners) listener();
    });
  }

  async send(frame: string): Promise<void> {
    if (!this.device) throw new Error('Bancada desconectada.');
    await this.device.writeCharacteristicWithResponseForService(BENCH_BLE.service, BENCH_BLE.rx, utf8ToBase64(frame));
  }

  onFrame(listener: (frame: string) => void): void {
    this.frameListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  async close(): Promise<void> {
    this.monitor?.remove();
    this.disconnect?.remove();
    if (this.device) await ble().cancelDeviceConnection(this.deviceId).catch(() => undefined);
    this.device = null;
  }
}
