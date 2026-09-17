/**
 * Thermal Printer (ESC/POS) Support
 * Supports WebUSB (Chrome/Edge) and Web Bluetooth for direct printing
 * Falls back to download .txt file for manual printing
 */

// Type declarations for WebUSB and Web Bluetooth (not in standard lib)
interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  configuration?: USBConfiguration;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
}

interface USBConfiguration {
  interfaces: USBInterface[];
}

interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
}

interface USBAlternateInterface {
  endpoints: USBEndpoint[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  packetSize: number;
}

interface USBOutTransferResult {
  status: 'ok' | 'stall' | 'babble';
  bytesWritten: number;
}

interface USB {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBDeviceFilter {
  classCode?: number;
  subclassCode?: number;
  vendorId?: number;
  productId?: number;
}

// Web Bluetooth types
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string | BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getCharacteristic(characteristic: string | BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    read: boolean;
    notify: boolean;
    indicate: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

type BluetoothServiceUUID = string;
type BluetoothCharacteristicUUID = string;

interface Bluetooth {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
}

interface BluetoothRequestDeviceOptions {
  filters: BluetoothLEScanFilter[];
  optionalServices?: string[];
}

interface BluetoothLEScanFilter {
  services?: string[];
  namePrefix?: string;
}

// Extend Navigator for WebUSB and Web Bluetooth
interface Navigator {
  usb?: USB;
  bluetooth?: Bluetooth;
}

export type PrinterConnection = 'webusb' | 'bluetooth' | 'download';

export interface PrinterDevice {
  id: string;
  name: string;
  connection: PrinterConnection;
  vendorId?: number;
  productId?: number;
}

export interface PrintJob {
  data: Uint8Array;
  copies?: number;
  cutPaper?: boolean;
}

/**
 * ESC/POS Command Builder
 */
export class EscPosBuilder {
  private commands: number[] = [];

  // Initialize printer
  init(): this {
    this.commands.push(0x1b, 0x40); // ESC @
    return this;
  }

  // Alignment
  alignLeft(): this {
    this.commands.push(0x1b, 0x61, 0x00); // ESC a 0
    return this;
  }

  alignCenter(): this {
    this.commands.push(0x1b, 0x61, 0x01); // ESC a 1
    return this;
  }

  alignRight(): this {
    this.commands.push(0x1b, 0x61, 0x02); // ESC a 2
    return this;
  }

  // Text formatting
  bold(on = true): this {
    this.commands.push(0x1b, 0x45, on ? 0x01 : 0x00); // ESC E
    return this;
  }

  underline(on = true): this {
    this.commands.push(0x1b, 0x2d, on ? 0x01 : 0x00); // ESC -
    return this;
  }

  doubleHeight(on = true): this {
    this.commands.push(0x1b, 0x21, on ? 0x10 : 0x00); // ESC ! (bit 4)
    return this;
  }

  doubleWidth(on = true): this {
    this.commands.push(0x1b, 0x21, on ? 0x20 : 0x00); // ESC ! (bit 5)
    return this;
  }

  doubleSize(on = true): this {
    this.commands.push(0x1b, 0x21, on ? 0x30 : 0x00); // ESC ! (bits 4+5)
    return this;
  }

  normalSize(): this {
    this.commands.push(0x1b, 0x21, 0x00); // ESC ! 0
    return this;
  }

  // Line feed
  feed(lines = 1): this {
    this.commands.push(0x1b, 0x64, lines); // ESC d n
    return this;
  }

  // Cut paper
  cut(full = true): this {
    this.commands.push(0x1d, 0x56, full ? 0x00 : 0x01, 0x00); // GS V m
    return this;
  }

  // Barcode (CODE128)
  barcode(data: string, height = 50): this {
    this.commands.push(0x1d, 0x68, height); // GS h
    this.commands.push(0x1d, 0x77, 2); // GS w
    this.commands.push(0x1d, 0x6b, 73); // GS k (CODE128)
    this.commands.push(data.length);
    for (const char of data) {
      this.commands.push(char.charCodeAt(0));
    }
    return this;
  }

  // QR Code
  qrCode(data: string, size = 3): this {
    this.commands.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // GS ( k pL pH cn fn n (model 2)
    this.commands.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size); // GS ( k pL pH cn fn n (size)
    const dataBytes = new TextEncoder().encode(data);
    this.commands.push(0x1d, 0x28, 0x6b, dataBytes.length + 3, 0x00, 0x31, 0x50, 0x30); // GS ( k pL pH cn fn m d1...dk
    for (const b of dataBytes) this.commands.push(b);
    this.commands.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // GS ( k pL pH cn fn m (print)
    return this;
  }

  // Raw text
  text(text: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    for (const b of bytes) this.commands.push(b);
    return this;
  }

  // New line
  newLine(): this {
    this.commands.push(0x0a); // LF
    return this;
  }

  // Build Uint8Array
  build(): Uint8Array {
    return new Uint8Array(this.commands);
  }
}

/**
 * WebUSB Printer Interface
 */
export class WebUsbPrinter {
  private device: USBDevice | null = null;

  async requestDevice(): Promise<PrinterDevice | null> {
    const nav = navigator as Navigator & { usb?: USB };
    if (!nav.usb) {
      throw new Error('WebUSB not supported in this browser');
    }

    try {
      this.device = await nav.usb.requestDevice({
        filters: [
          { classCode: 0x07 }, // Printer class
          { classCode: 0xff, subclassCode: 0x00 }, // Vendor specific
        ],
      });

      if (!this.device) return null;

      await this.device.open();
      await this.device.selectConfiguration(1);

      // Claim interface (usually interface 0)
      const interfaces = this.device.configuration?.interfaces ?? [];
      for (const iface of interfaces) {
        try {
          await this.device.claimInterface(iface.interfaceNumber);
          break;
        } catch {
          // Continue to next interface
        }
      }

      return {
        id: `${this.device.vendorId}:${this.device.productId}`,
        name: this.device.productName ?? `USB Printer (${this.device.vendorId}:${this.device.productId})`,
        connection: 'webusb',
        vendorId: this.device.vendorId,
        productId: this.device.productId,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  async print(job: PrintJob): Promise<void> {
    if (!this.device) {
      throw new Error('No USB device selected');
    }

    const interfaces = this.device.configuration?.interfaces ?? [];
    if (interfaces.length === 0) {
      throw new Error('No USB interfaces available');
    }

    const iface = interfaces[0];
    const endpoints = iface.alternates[0]?.endpoints ?? [];

    // Find OUT endpoint (direction: 'out')
    const outEndpoint = endpoints.find((ep) => ep.direction === 'out');
    if (!outEndpoint) {
      throw new Error('No OUT endpoint found on printer');
    }

    // Send data in chunks (max packet size)
    const chunkSize = outEndpoint.packetSize || 512;
    const data = job.data;
    let offset = 0;

    while (offset < data.length) {
      const chunk = data.slice(offset, offset + chunkSize);
      await this.device.transferOut(outEndpoint.endpointNumber, chunk);
      offset += chunk.length;
    }

    // Send cut command if requested
    if (job.cutPaper) {
      const cutCmd = new Uint8Array([0x1d, 0x56, 0x00, 0x00]); // GS V 0 0
      await this.device.transferOut(outEndpoint.endpointNumber, cutCmd);
    }

    // Print additional copies
    for (let i = 1; i < (job.copies ?? 1); i++) {
      offset = 0;
      while (offset < data.length) {
        const chunk = data.slice(offset, offset + chunkSize);
        await this.device.transferOut(outEndpoint.endpointNumber, chunk);
        offset += chunk.length;
      }
      if (job.cutPaper) {
        await this.device.transferOut(outEndpoint.endpointNumber, new Uint8Array([0x1d, 0x56, 0x00, 0x00]));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
      } catch {
        // Ignore close errors
      }
      this.device = null;
    }
  }

  isConnected(): boolean {
    return this.device?.opened ?? false;
  }
}

/**
 * Web Bluetooth Printer Interface
 */
export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async requestDevice(): Promise<PrinterDevice | null> {
    const nav = navigator as Navigator & { bluetooth?: Bluetooth };
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth not supported in this browser');
    }

    try {
      this.device = await nav.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common POS printer service
          { namePrefix: 'POS' },
          { namePrefix: 'Printer' },
          { namePrefix: 'Thermal' },
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb'],
      });

      if (!this.device) return null;

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('Failed to connect to GATT server');

      // Try common printer service UUIDs
      const serviceUuids = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Common thermal printer
      ];

      for (const uuid of serviceUuids) {
        try {
          const service = await server.getPrimaryService(uuid);
          const characteristics = await service.getCharacteristics();

          // Find writable characteristic
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.characteristic = char;
              break;
            }
          }
          if (this.characteristic) break;
        } catch {
          // Try next UUID
        }
      }

      if (!this.characteristic) {
        throw new Error('No writable characteristic found on printer');
      }

      return {
        id: this.device.id,
        name: this.device.name ?? `Bluetooth Printer (${this.device.id})`,
        connection: 'bluetooth',
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  async print(job: PrintJob): Promise<void> {
    if (!this.characteristic) {
      throw new Error('No printer characteristic available');
    }

    const data = job.data;
    const chunkSize = 20; // BLE MTU is typically 20 bytes

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      await this.characteristic.writeValue(chunk);
      // Small delay to avoid overwhelming the printer
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Send cut command if requested
    if (job.cutPaper) {
      const cutCmd = new Uint8Array([0x1d, 0x56, 0x00, 0x00]);
      await this.characteristic.writeValue(cutCmd);
    }

    // Print additional copies
    for (let i = 1; i < (job.copies ?? 1); i++) {
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize);
        await this.characteristic.writeValue(chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (job.cutPaper) {
        await this.characteristic.writeValue(new Uint8Array([0x1d, 0x56, 0x00, 0x00]));
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  isConnected(): boolean {
    return this.device?.gatt?.connected ?? false;
  }
}

/**
 * Download fallback - saves ESC/POS as .txt file
 */
export async function downloadReceipt(data: Uint8Array, filename = 'receipt.escpos'): Promise<void> {
  const blob = new Blob([data as unknown as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * High-level print function that tries WebUSB -> Bluetooth -> Download
 */
export async function printReceipt(
  escposData: Uint8Array,
  options: { copies?: number; cutPaper?: boolean; preferredConnection?: PrinterConnection } = {},
): Promise<{ success: boolean; connection: PrinterConnection; error?: string }> {
  const { copies = 1, cutPaper = true, preferredConnection } = options;
  const job: PrintJob = { data: escposData, copies, cutPaper };

  // Try preferred connection first, then fallback order
  const fallbackOrder: PrinterConnection[] = ['webusb', 'bluetooth', 'download'];
  const connectionOrder: PrinterConnection[] = preferredConnection
    ? [preferredConnection, ...fallbackOrder].filter((c, i, a) => a.indexOf(c) === i)
    : fallbackOrder;

  for (const connection of connectionOrder) {
    try {
      switch (connection) {
        case 'webusb': {
          const printer = new WebUsbPrinter();
          const device = await printer.requestDevice();
          if (!device) continue;
          await printer.print(job);
          await printer.disconnect();
          return { success: true, connection: 'webusb' };
        }
        case 'bluetooth': {
          const printer = new BluetoothPrinter();
          const device = await printer.requestDevice();
          if (!device) continue;
          await printer.print(job);
          await printer.disconnect();
          return { success: true, connection: 'bluetooth' };
        }
        case 'download': {
          await downloadReceipt(escposData);
          return { success: true, connection: 'download' };
        }
      }
    } catch (error) {
      console.warn(`[Print] ${connection} failed:`, error);
      continue;
    }
  }

  return { success: false, connection: 'download', error: 'All print methods failed' };
}