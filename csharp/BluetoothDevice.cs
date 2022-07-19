// Decompiled with JetBrains decompiler
// Type: Corelec.BluetoothDevice
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Corelec.Vues;
using Plugin.BLE.Abstractions.Contracts;

namespace Corelec
{
  public class BluetoothDevice
  {
    public IDevice HwDevice;
    public string BtAddress;
    public bool IsDemo;
    public int PinCode;
    public int Channel;

    public BluetoothDevice(IDevice hwbtdev, bool demo, int comm = 0)
    {
      this.IsDemo = demo;
      this.Channel = comm;
      if (hwbtdev != null)
        this.BtAddress = hwbtdev.Id.ToString().Substring(24).ToUpper();
      if (this.IsDemo)
        this.BtAddress = Constantes.BT_DEMODEVICE;
      if (hwbtdev != null)
        this.HwDevice = hwbtdev;
      if (this.IsDemo)
        return;
      this.PinCode = Utils.CalculePin(this.BtAddress);
    }

    public Bluetooth ToView() => new Bluetooth(this.BtAddress, this.IsDemo, this.Channel);
  }
}
