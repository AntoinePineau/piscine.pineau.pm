// Decompiled with JetBrains decompiler
// Type: Corelec.sMinMax
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

namespace Corelec
{
  public struct sMinMax
  {
    public double Min;
    public double Max;

    public void RaZ()
    {
      this.Min = Constantes.NOT_SET;
      this.Max = Constantes.NOT_SET;
    }

    public sMinMax(double min, double max)
    {
      this.Min = min;
      this.Max = max;
    }
  }
}
