// Decompiled with JetBrains decompiler
// Type: Corelec.sSeuils
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

namespace Corelec
{
  public struct sSeuils
  {
    public sMinMax Absolus;
    public sMinMax Warnings;
    public sMinMax Erreurs;
    public sMinMax Calibration;

    public void RaZ()
    {
      this.Warnings.RaZ();
      this.Erreurs.RaZ();
      this.Calibration.RaZ();
      this.Absolus.RaZ();
    }
  }
}
