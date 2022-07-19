// Decompiled with JetBrains decompiler
// Type: Corelec.appareilsWWW
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using System;
using System.Globalization;

namespace Corelec
{
  public class appareilsWWW
  {
    public string App;
    public string Desi;
    public string Loc;
    public string Type;
    public string Soft;
    public string Evt;
    public string Ph;
    public string Cph;
    public string Sel;
    public string Temp;
    public string Prod;
    public string Chl;
    public string CChl;
    public string Tms;

    public DateTime xTms => !string.IsNullOrEmpty(this.Tms) ? Convert.ToDateTime(this.Tms) : DateTime.Now;

    public int xAlarme
    {
      get
      {
        if (string.IsNullOrEmpty(this.Evt))
          return 0;
        return int.Parse(this.Evt.Split('.')[0]);
      }
    }

    public void AffectationValeurs(Appareil app)
    {
      appareilsWWW appareilsWww = this;
      app.eRegulateur = (eRegulateurs) int.Parse(appareilsWww.Type);
      app.BluetoothId = appareilsWww.App;
      app.DerniereRemontee = this.xTms;
      app.Alarme = this.xAlarme;
      if (appareilsWww.Ph != null)
      {
        app.valPh.Valeur = double.Parse(appareilsWww.Ph, (IFormatProvider) CultureInfo.InvariantCulture);
        app.valPh.Consigne = double.Parse(appareilsWww.Cph, (IFormatProvider) CultureInfo.InvariantCulture);
      }
      if (appareilsWww.Chl != null)
      {
        app.valAmp.Valeur = double.Parse(appareilsWww.Chl, (IFormatProvider) CultureInfo.InvariantCulture);
        app.valAmp.Consigne = double.Parse(appareilsWww.CChl, (IFormatProvider) CultureInfo.InvariantCulture);
        app.valRdx.Valeur = double.Parse(appareilsWww.Chl, (IFormatProvider) CultureInfo.InvariantCulture);
        app.valRdx.Consigne = double.Parse(appareilsWww.CChl, (IFormatProvider) CultureInfo.InvariantCulture);
      }
      if (appareilsWww.Sel != null)
        app.valSel.Valeur = double.Parse(appareilsWww.Sel, (IFormatProvider) CultureInfo.InvariantCulture);
      if (appareilsWww.Temp != null)
        app.valTemp.Valeur = double.Parse(appareilsWww.Temp, (IFormatProvider) CultureInfo.InvariantCulture);
      if (appareilsWww.Prod == null)
        return;
      app.valElx.Valeur = double.Parse(appareilsWww.Prod, (IFormatProvider) CultureInfo.InvariantCulture);
    }
  }
}
