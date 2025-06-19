import asyncio
from bleak import BleakClient

async def main():
    device_address = "80:4B:50:D0:53:49"  # Your device's MAC address
    async with BleakClient(device_address) as client:
        print(f"Connected: {client.is_connected}")
        services = await client.get_services()
        for service in services:
            print(f"Service: {service.uuid}")
            for char in service.characteristics:
                print(f"  Characteristic: {char.uuid} - {char.properties}")

if __name__ == "__main__":
    asyncio.run(main())

#Service: 00001800-0000-1000-8000-00805f9b34fb
#  Characteristic: 00002a00-0000-1000-8000-00805f9b34fb - ['read']
#  Characteristic: 00002a01-0000-1000-8000-00805f9b34fb - ['read']
#Service: 0bd51666-e7cb-469b-8e4d-2742f1ba77cc
#  Characteristic: e7add780-b042-4876-aae1-112855353cc1 - ['write', 'indicate']