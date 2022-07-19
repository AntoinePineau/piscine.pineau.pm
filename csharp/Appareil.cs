// Decompiled with JetBrains decompiler
// Type: Corelec.Appareil
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using System;

namespace Corelec
{
  public class Appareil
  {
    public eLangues eLangue;
    public eRegulateurs eRegulateur;
    public int PinCode;
    public int PinCodeSoft;
    public bool PinCorrect;
    public byte RawFieldM13;
    public byte RawFieldA10;
    public int Alarme;
    public int Warning;
    public int AlarmeRdx;
    public int AlarmeElx;
    public Donnee valPh;
    public Donnee valSel;
    public Donnee valTemp;
    public Donnee valRdx;
    public Donnee valAmp;
    public Donnee valElx;
    public bool IsDemo;
    public bool Ikare;
    public string BluetoothId;
    public char TramePrioritaire;
    public bool Virtuel;
    public string Designation;
    public string Location;
    public DateTime DerniereRemontee = DateTime.Now;
    public string Version = "0.0a+0.0b";
    public bool PompePlus;
    public bool PompeMoins;
    public bool PompeChlore;
    public bool FlowSwitch;
    public bool CapteurSel;
    public bool CapteurTemp;
    public bool PompesForcees;
    public bool PompePlusActive;
    public bool PompeMoinsActive;
    public bool PompeChlElxActive;
    public bool RelaisFilActif;
    public bool VoletForcé;
    public bool VoletActif;
    public bool BoostActif;
    public int DureeBoost;
    public int Salinite;
    public bool Sleep;
    public bool Timer;
    public int DureeST;

    public string BluetoothIdRaw => this.BluetoothId.Replace(":", "");

    public Appareil(string Designation)
    {
      this.BluetoothId = Designation;
      this.Virtuel = true;
      this.Elements_Communs();
    }

    public Appareil(BluetoothDevice btdevice)
    {
      this.PinCode = btdevice.PinCode;
      this.IsDemo = btdevice.IsDemo;
      this.Ikare = false;
      this.Virtuel = false;
      this.BluetoothId = btdevice.BtAddress;
      this.Elements_Communs();
    }

    public Appareil(IkareDevice webdevice)
    {
      this.PinCode = webdevice.PinCode;
      this.IsDemo = false;
      this.Ikare = true;
      this.Virtuel = false;
      this.Designation = webdevice.wwwREGUL.Desi;
      this.Elements_Communs();
      webdevice.wwwREGUL.AffectationValeurs(this);
    }

    public void Elements_Communs()
    {
      this.eLangue = eLangues.FR;
      this.valPh = new Donnee(eMesures.ph);
      this.valSel = new Donnee(eMesures.sel);
      this.valTemp = new Donnee(eMesures.temp);
      this.valRdx = new Donnee(eMesures.redox);
      this.valAmp = new Donnee(eMesures.amp);
      this.valElx = new Donnee(eMesures.elx);
      if (!this.IsDemo || this.Virtuel)
        return;
      this.eRegulateur = eRegulateurs.DuoRegul4Rx;
      this.valPh.Consigne = 7.3;
      this.valPh.Valeur = 7.21;
      this.valRdx.Consigne = 750.0;
      this.valRdx.Valeur = 432.0;
      this.valSel.Valeur = 1.8;
      this.valTemp.Valeur = 19.7;
      this.valElx.Valeur = 75.0;
    }

    public void DecoupageTrameBLE(byte[] trame) => Trames.ExtractionTrame((char) trame[1], trame, this);

    public bool IsAkeron() => this.eRegulateur == eRegulateurs.Duo || this.eRegulateur == eRegulateurs.DuoRegul3 || this.eRegulateur == eRegulateurs.DuoRegul4Amp || this.eRegulateur == eRegulateurs.DuoRegul4Rx;

    public bool IsElxExt() => this.eRegulateur == eRegulateurs.Regul4Rx && !this.PompeChlore;

    public bool IsPompeChl() => this.eRegulateur == eRegulateurs.Regul4Rx && this.PompeChlore;
  }
}
