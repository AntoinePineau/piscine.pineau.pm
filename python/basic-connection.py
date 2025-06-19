import asyncio
from bleak import BleakClient

async def main():
    device_address = "80:4B:50:D0:53:49"  # Your device's MAC address

    try:
        async with BleakClient(device_address) as client:
            connected = await client.is_connected()
            print(f"Connected: {connected}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(main())
