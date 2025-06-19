import firebase_admin
from firebase_admin import credentials, firestore
import asyncio
from bleak import BleakClient, BleakError
from datetime import datetime

# Initialize Firestore DB
cred = credentials.Certificate('piscine-pineau-morin-firebase-adminsdk-7jfph-8571cb3029.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

async def indication_handler(sender, data):
    try:
        print("Indication handler called")  # Debug print
        if not data:
            print("No data received.")
            return
        
        print(f"Raw data: {data}")  # Debug print
        trame = list(data)
        
        if len(trame) < 13:
            print(f"Received trame is too short: {len(trame)} bytes")
            return
        
        processed_data = process_trame(trame)
        
        if processed_data:
            print(f"Processed data: {processed_data}")  # Log the processed data
            if 6 < processed_data['pH'] < 9:
                doc_ref = db.collection('pool_data').add(processed_data)
                print(f"Data added to Firestore with ID: {doc_ref}")
                await asyncio.sleep(1)  # Small delay before stopping
                await asyncio.get_event_loop().stop()  # Stop the event loop
        else:
            print("Processed data is None or invalid.")
    
    except Exception as e:
        print(f"Error in indication_handler: {e}")

def process_trame(trame):
    if len(trame) < 13:
        print("Incomplete data received")  # Debug print
        return None

    current_time = datetime.now()
    timestamp_id = current_time.strftime("%Y%m%d%H%M%S")  # Generate ID in the format YYYYMMDDHHmmss

    data = {}
    data['id'] = timestamp_id
    data['date'] = current_time  # Store as a Firestore Timestamp
    data['date_string'] = current_time.isoformat()  # Store as ISO formatted string (optional)

    data['pH'] = byte_to_double(trame[2], trame[3]) / 100.0
    data['RX'] = byte_to_double(trame[4], trame[5])
    data['amp'] = byte_to_double(trame[4], trame[5]) / 100.0
    data['C°'] = byte_to_double(trame[6], trame[7]) / 10.0
    data['sel'] = byte_to_double(trame[8], trame[9]) / 10.0
    data['alarme'] = trame[10]
    data['warning'] = trame[11] & 15
    data['alarmeRX'] = trame[11] >> 4
    data['eRegulateur'] = trame[12] & 15
    data['pompePlusActive'] = (trame[12] & 0x80) != 0
    data['pompeMoinsActive'] = (trame[12] & 0x40) != 0
    
    return data

def byte_to_double(byte1, byte2):
    return (byte1 << 8) + byte2

async def disconnect(client, indicate_char=None):    
    if client.is_connected:
        if indicate_char is not None:
            await client.stop_notify(indicate_char.uuid)
        await client.disconnect()
    print("Disconnected")

async def ensure_disconnected(client):
    if client.is_connected:
        print("Previous connection detected, disconnecting...")
        await client.disconnect()

async def connect_and_indicate(device_address):
    client = BleakClient(device_address)
    indicate_char = None

    try:
        # Ensure any previous connection is closed
        await ensure_disconnected(client)

        await client.connect()
        print(f"Connected: {client.is_connected}")
        for service in client.services:
            for characteristic in service.characteristics:
                if "indicate" in characteristic.properties:
                    indicate_char = characteristic
                    break
            if indicate_char:
                break

        if indicate_char is None:
            print("No indicate characteristic found!")
            await disconnect(client)
            return

        print(f"Found indicate characteristic: {indicate_char.uuid}")
        await client.start_notify(indicate_char.uuid, indication_handler)
        print(f"Started indications on {indicate_char.uuid}")

        while client.is_connected:
            await asyncio.sleep(1)  # Keep the connection alive

    except BleakError as e:
        print(f"Failed to connect or notify: {e}")

    finally:
        await disconnect(client, indicate_char)
        await asyncio.sleep(2)  # Allow a brief grace period before reconnecting

async def main():
    device_address = "80:4B:50:D0:53:49"  # Your device's MAC address

    while True:
        await connect_and_indicate(device_address)
        await asyncio.sleep(5)  # Wait before trying to reconnect

if __name__ == '__main__':
    asyncio.run(main())
