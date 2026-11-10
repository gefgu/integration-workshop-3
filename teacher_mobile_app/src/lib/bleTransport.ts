/**
 * Bluetooth LE link to a real bench: frames are written to RX and arrive as TX notifications.
 * Needs a development build (`npx expo run:android`), not Expo Go.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, ConnectionPriority, type Device, type Subscription } from 'react-native-ble-plx';
import { BENCH_BLE } from '../../../protocol/bench.ts';
import { base64ToUtf8, utf8ToBase64 } from './base64.ts';
import type { BenchTransport } from './benchClient.ts';
import { writeWithResume } from './resume.ts';

const REQUESTED_MTU = 517;
/** A healthy acknowledged write takes tens of ms; past this the link is taken as stalled and reconnected. */
const WRITE_TIMEOUT_MS = 8_000;
const RESUME_ATTEMPTS = 3;

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
  maxFrameBytes: number | undefined;
  private reconnecting = false;
  private closed = false;
  private writes = 0;

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
    if (Platform.OS === 'android') {
      // A module is ~140 kB of ASCII JSON in ~1000 acknowledged writes; a short connection interval speeds them
      // up. The MTU only has to fit DEFAULT_CHUNK + header (frames never grow past that, see BenchClient).
      // Either request may be refused; keep defaults then.
      device = await device.requestMTU(REQUESTED_MTU).catch(() => device);
      await device.requestConnectionPriority(ConnectionPriority.High).catch(() => undefined);
    }
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;
    // One ATT write carries MTU - 3 bytes; bless ignores long-write offsets, so a frame must fit in one write.
    this.maxFrameBytes = device.mtu && device.mtu > 23 ? Math.min(device.mtu, REQUESTED_MTU) - 3 : undefined;
    this.monitor = device.monitorCharacteristicForService(BENCH_BLE.service, BENCH_BLE.tx, (error, characteristic) => {
      if (error || !characteristic?.value) return;
      const frame = base64ToUtf8(characteristic.value);
      for (const listener of this.frameListeners) listener(frame);
    });
    this.disconnect = ble().onDeviceDisconnected(this.deviceId, () => {
      this.device = null;
      if (this.reconnecting) return; // send() is bringing the link back; the session goes on
      for (const listener of this.closeListeners) listener();
    });
  }

  /**
   * Writes one frame. The Pi's radio sometimes stops acknowledging in the middle of a module (hundreds of
   * writes): after WRITE_TIMEOUT_MS the phone reconnects and writes the same frame again, and the bench, which
   * kept the frames it already had, goes on from there.
   */
  async send(frame: string): Promise<void> {
    if (this.maxFrameBytes && frame.length > this.maxFrameBytes) {
      // Frames are ASCII (one byte per char). A reconnection may have negotiated a smaller MTU than the frames
      // were cut for; sending would make a long write that the bench cannot rebuild.
      throw new Error(`Pacote Bluetooth grande demais (${frame.length} > ${this.maxFrameBytes} bytes). Reconecte e envie de novo.`);
    }
    const value = utf8ToBase64(frame);
    await writeWithResume(
      async (onTimeout) => {
        if (!this.device) throw new Error('Bancada desconectada.');
        const transaction = `w${++this.writes}`;
        onTimeout(() => void ble().cancelTransaction(transaction));
        await this.device.writeCharacteristicWithResponseForService(BENCH_BLE.service, BENCH_BLE.rx, value, transaction);
      },
      () => this.reconnect(),
      { writeTimeoutMs: WRITE_TIMEOUT_MS, attempts: RESUME_ATTEMPTS, onRetry: (n) => this.onRetry?.(n) }
    );
  }

  /** Set by the screen during a send: called before each reconnection (1-based). */
  onRetry: ((attempt: number) => void) | null = null;

  async reconnect(): Promise<void> {
    if (this.closed) throw new Error('Bancada desconectada.');
    this.reconnecting = true;
    try {
      this.monitor?.remove();
      this.disconnect?.remove();
      await ble().cancelDeviceConnection(this.deviceId).catch(() => undefined);
      this.device = null;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // let BlueZ drop the old link first
      await this.connect();
    } finally {
      this.reconnecting = false;
    }
  }

  onFrame(listener: (frame: string) => void): void {
    this.frameListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.monitor?.remove();
    this.disconnect?.remove();
    if (this.device) await ble().cancelDeviceConnection(this.deviceId).catch(() => undefined);
    this.device = null;
  }
}
