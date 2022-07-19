// Decompiled with JetBrains decompiler
// Type: Corelec.IkareDevice
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Corelec.Vues;
using System;
using System.Collections.Generic;

namespace Corelec
{
  public class IkareDevice
  {
    public static string Login;
    public int AppStatus;
    private Random rnd = new Random();
    public int PinCode;
    public appareilsWWW wwwREGUL;
    public List<mesuresWWW> wwwMESURES;
    public commandeWWW wwwCOMMANDE;

    public IkareDevice()
    {
      this.PinCode = 0;
      this.AppStatus = this.rnd.Next(4);
    }

    public Ikare ToView()
    {
      Ikare ikare = new Ikare();
      ikare.Piscine = this.wwwREGUL.Desi;
      int result = 5;
      int.TryParse(this.wwwREGUL.Type, out result);
      ikare.Location = string.Format("[{0}]  {1}", new object[2]
      {
        (object) Utils.ModeleVersChaine((eRegulateurs) result),
        (object) this.wwwREGUL.Loc
      });
      ikare.Appareil = this.wwwREGUL.App;
      ikare.Status = this.DefiniStatus();
      return ikare;
    }

    private int DefiniStatus()
    {
      if (this.wwwREGUL.xAlarme >= 10)
        return 1;
      if (this.wwwREGUL.xAlarme < 10 && this.wwwREGUL.xAlarme > 0)
        return 2;
      return DateTime.Now.AddHours(-Constantes.PAS_DE_REMONTEES) > this.wwwREGUL.xTms ? 4 : 3;
    }
  }
}
