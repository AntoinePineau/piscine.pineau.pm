// Decompiled with JetBrains decompiler
// Type: Corelec.mesuresWWW
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using System;
using System.Globalization;

namespace Corelec
{
  public class mesuresWWW
  {
    public string Val;
    public string Con;
    public string Tms;

    public DateTime xTms => !string.IsNullOrEmpty(this.Tms) ? Convert.ToDateTime(this.Tms) : DateTime.Now;

    public double xVal => Convert.ToDouble(this.Val, (IFormatProvider) CultureInfo.InvariantCulture);

    public double xCon => Convert.ToDouble(this.Con, (IFormatProvider) CultureInfo.InvariantCulture);
  }
}
