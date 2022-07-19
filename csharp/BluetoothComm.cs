// Decompiled with JetBrains decompiler
// Type: Corelec.BluetoothComm
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Plugin.BLE;
using Plugin.BLE.Abstractions;
using Plugin.BLE.Abstractions.Contracts;
using Plugin.BLE.Abstractions.EventArgs;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Corelec
{
  public static class BluetoothComm
  {
    private static string BT_NAME_A = "CORELEC Regulateur";
    private static string BT_NAME_B = "REGUL.";
    private static Guid BT_UART_SERVICE = Guid.Parse("0bd51666-e7cb-469b-8e4d-2742f1ba77cc");
    private static Guid BT_UART_CARACT = Guid.Parse("e7add780-b042-4876-aae1-112855353cc1");
    public static List<BluetoothDevice> BleDevices = new List<BluetoothDevice>();
    private static IBluetoothLE BtBLE = CrossBluetoothLE.Current;
    private static IAdapter BtAdapter = CrossBluetoothLE.Current.Adapter;
    public static ICharacteristic myCarac;
    public static bool Done = true;
    private static byte[] bleBuffer = new byte[2048];
    private static int bleIndex = 0;
    public static int bleNoSync = 0;
    private static bool trameInitiale = false;
    private static byte[] trame = new byte[20];

    public static async Task HwBtStart(bool longScan = false)
    {
      BluetoothComm.Done = false;
      BluetoothComm.BleDevices.Clear();
      if (Globales.DemoDevice)
        BluetoothComm.BleDevices.Add(new BluetoothDevice((IDevice) null, true));
      BluetoothComm.BtBLE.StateChanged += new EventHandler<BluetoothStateChangedArgs>(BluetoothComm.OnBtStateChanged);
      BluetoothComm.BtAdapter.DeviceDiscovered += new EventHandler<DeviceEventArgs>(BluetoothComm.OnBtDeviceFound);
      BluetoothComm.BtAdapter.ScanTimeout = !longScan ? 4000 : 9000;
      foreach (IDevice connectedDevice in (IEnumerable<IDevice>) BluetoothComm.BtAdapter.ConnectedDevices)
        await BluetoothComm.BtAdapter.DisconnectDeviceAsync(connectedDevice);
      BluetoothComm.BtAdapter.ScanTimeoutElapsed += new EventHandler(BluetoothComm.OnScanOver);
      if (!BluetoothComm.BtBLE.IsAvailable || !BluetoothComm.BtBLE.IsOn)
      {
        Utils.Log("BLE: adaptateur non trouvé ou OFF sur ce device.");
        BluetoothComm.Done = true;
      }
      else
        await BluetoothComm.BtAdapter.StartScanningForDevicesAsync();
    }

    private static void OnScanOver(object s, System.EventArgs e) => BluetoothComm.Done = true;

    public static async Task HwBtOpen(BluetoothDevice btDevice)
    {
      await BluetoothComm.BtAdapter.ConnectToDeviceAsync(btDevice.HwDevice, new ConnectParameters(true));
      BluetoothComm.myCarac = await (await btDevice.HwDevice.GetServiceAsync(BluetoothComm.BT_UART_SERVICE)).GetCharacteristicAsync(BluetoothComm.BT_UART_CARACT);
      BluetoothComm.myCarac.ValueUpdated += new EventHandler<CharacteristicUpdatedEventArgs>(BluetoothComm.OnValueUpdated);
      await BluetoothComm.myCarac.StartUpdatesAsync();
      await BluetoothComm.BleInitial();
      Utils.Log(string.Format("BLE: ouvert et connecté sur {0}", new object[1]
      {
        (object) btDevice.BtAddress
      }));
    }

    public static async Task BleInitial()
    {
      char[] chArray = new char[6]
      {
        'M',
        'E',
        'S',
        'A',
        'D',
        'B'
      };
      for (int index = 0; index < chArray.Length; ++index)
      {
        char mnemo = chArray[index];
        int cpt = 0;
        BluetoothComm.trameInitiale = false;
        while (!BluetoothComm.trameInitiale && cpt++ < 10000)
          await BluetoothComm.BleAsk(mnemo);
      }
      chArray = (char[]) null;
    }

    public static async Task BleAsk(char quoi)
    {
      byte[] bArray = Trames.TrameCommande(quoi);
      if (bArray == null)
        return;
      string str = await BluetoothComm.BleWrite(bArray, Globales.Regulateur.IsDemo);
    }

    public static async Task<string> BleWrite(byte[] bArray, bool noSend = false)
    {
      string cible = noSend ? "DEMO" : "BLE";
      string trameResultat = string.Empty;
      try
      {
        bArray[bArray.Length - 2] = Utils.Calcul_CRC(bArray, bArray.Length - 2);
        trameResultat = BitConverter.ToString(bArray);
        if (!noSend)
        {
          int num = await BluetoothComm.myCarac.WriteAsync(bArray) ? 1 : 0;
        }
        Utils.Log(string.Format("{0}: sent {1}", new object[2]
        {
          (object) cible,
          (object) trameResultat
        }));
      }
      catch
      {
        Utils.Log(string.Format("{0}: sent HS {1}", new object[2]
        {
          (object) cible,
          (object) trameResultat
        }));
        ++BluetoothComm.bleNoSync;
      }
      return trameResultat;
    }

    private static void OnValueUpdated(object o, CharacteristicUpdatedEventArgs e)
    {
      byte[] numArray = e.Characteristic.Value;
      foreach (byte num in numArray)
      {
        BluetoothComm.bleBuffer[BluetoothComm.bleIndex++] = num;
        BluetoothComm.bleBuffer[BluetoothComm.bleIndex] = (byte) 207;
      }
      if (!BluetoothComm.ParseBufferReception())
        return;
      BluetoothComm.trameInitiale = true;
      Utils.Log(string.Format("BLE: trame recue {0}", new object[1]
      {
        (object) BitConverter.ToString(numArray)
      }));
      Globales.Regulateur.DecoupageTrameBLE(BluetoothComm.trame);
    }

    private static bool ParseBufferReception()
    {
      if (BluetoothComm.bleIndex > 468)
        BluetoothComm.bleIndex = 0;
      if (BluetoothComm.bleIndex < 16)
        return false;
      for (int index1 = 0; index1 < BluetoothComm.bleIndex; ++index1)
      {
        if (BluetoothComm.bleBuffer[index1] == (byte) 42 && BluetoothComm.bleBuffer[index1 + 16] == (byte) 42)
        {
          for (int index2 = 0; index2 < 17; ++index2)
            BluetoothComm.trame[index2] = BluetoothComm.bleBuffer[index1 + index2];
          if ((int) BluetoothComm.trame[15] == (int) Utils.Calcul_CRC(BluetoothComm.trame, 15))
          {
            BluetoothComm.bleIndex = 0;
            BluetoothComm.bleBuffer[0] = (byte) 207;
            return true;
          }
        }
      }
      return false;
    }

    private static void OnBtStateChanged(object sender, BluetoothStateChangedArgs e) => Utils.Log(string.Format("BLE: BT maintenant dans l'état: {0}", new object[1]
    {
      (object) e.NewState
    }));

    private static void OnBtDeviceFound(object sender, DeviceEventArgs e)
    {
      Utils.Log(string.Format("BLE: Device decouvert: {0}/{1}", new object[2]
      {
        (object) e.Device.Name,
        (object) e.Device.Id
      }));
      if (!(e.Device.Name == BluetoothComm.BT_NAME_A) && !(e.Device.Name == BluetoothComm.BT_NAME_B))
        return;
      bool flag = false;
      foreach (BluetoothDevice bleDevice in BluetoothComm.BleDevices)
      {
        if (bleDevice.HwDevice != null && bleDevice.HwDevice.Id == e.Device.Id)
          flag = true;
      }
      if (flag)
        return;
      BluetoothComm.BleDevices.Add(new BluetoothDevice(e.Device, false, 1));
      if (!Globales.ForceWifi)
        return;
      BluetoothComm.BleDevices.Add(new BluetoothDevice(e.Device, false, 2));
    }
  }
}
