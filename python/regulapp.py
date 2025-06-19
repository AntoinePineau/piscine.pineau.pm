import asyncio
from bleak import BleakClient
import requests

async def notification_handler(sender, data):
    trame = list(data)
    processed_data = process_trame(trame)
    if processed_data:
        print(f"Data: {processed_data}")  # Log the data array
        status_code, response_text = send_data_to_server(processed_data, "http://yourserver.com/data_endpoint")
        print(f"Server responded with status code {status_code}: {response_text}")

def process_trame(trame):
    if len(trame) < 13:
        return None

    data = {}
    data['valPh'] = byte_to_double(trame[2], trame[3]) / 100.0
    data['valRdx'] = byte_to_double(trame[4], trame[5])
    data['valAmp'] = byte_to_double(trame[4], trame[5]) / 100.0
    data['valTemp'] = byte_to_double(trame[6], trame[7]) / 10.0
    data['valSel'] = byte_to_double(trame[8], trame[9]) / 10.0
    data['alarme'] = trame[10]
    data['warning'] = trame[11] & 15
    data['alarmeRdx'] = trame[11] >> 4
    data['eRegulateur'] = trame[12] & 15
    data['pompePlusActive'] = (trame[12] & 0x80) != 0
    data['pompeMoinsActive'] = (trame[12] & 0x40) != 0
    
    return data

def byte_to_double(byte1, byte2):
    return (byte1 << 8) + byte2

def send_data_to_server(data, url):
    response = requests.post(url, json=data)
    return response.status_code, response.text

async def main():
    device_address = "80:4B:50:D0:53:49"  # Your device's MAC address
    char_uuid = "e7add780-b042-4876-aae1-112855353cc1"  # Characteristic UUID

    async with BleakClient(device_address) as client:
        print(f"Connected: {client.is_connected}")

        await client.start_notify(char_uuid, notification_handler)

        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
