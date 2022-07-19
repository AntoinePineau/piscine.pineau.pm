// Decompiled with JetBrains decompiler
// Type: Corelec.Trames
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Corelec
{
  public static class Trames
  {
    public static void ExtractionTrame(char mnemo, byte[] trame, Appareil appareil)
    {
      switch (mnemo)
      {
        case 'A':
          Trames.ExtractionTrameA(trame, appareil);
          break;
        case 'B':
          Trames.ExtractionTrameB(trame, appareil);
          break;
        case 'D':
          Trames.ExtractionTrameD(trame, appareil);
          break;
        case 'E':
          Trames.ExtractionTrameE(trame, appareil);
          break;
        case 'J':
          Trames.ExtractionTrameJ(trame, appareil);
          break;
        case 'M':
          Trames.ExtractionTrameM(trame, appareil);
          break;
        case 'S':
          Trames.ExtractionTrameS(trame, appareil);
          break;
      }
    }

    public static void ExtractionTrameM(byte[] trame, Appareil appareil)
    {
      appareil.valPh.Valeur = Utils.ByteVersDouble(trame[2], trame[3]) / 100.0;
      appareil.valRdx.Valeur = Utils.ByteVersDouble(trame[4], trame[5]);
      appareil.valAmp.Valeur = Utils.ByteVersDouble(trame[4], trame[5]) / 100.0;
      appareil.valTemp.Valeur = Utils.ByteVersDouble(trame[6], trame[7]) / 10.0;
      appareil.valSel.Valeur = Utils.ByteVersDouble(trame[8], trame[9]) / 10.0;
      appareil.Alarme = (int) trame[10];
      appareil.Warning = (int) trame[11] & 15;
      appareil.AlarmeRdx = (int) trame[11] >> 4;
      appareil.eRegulateur = (eRegulateurs) ((int) trame[12] & 15);
      appareil.PompePlusActive = Utils.ByteVersBool(trame[12], 7);
      appareil.PompeMoinsActive = Utils.ByteVersBool(trame[12], 6);
      appareil.PompeChlElxActive = Utils.ByteVersBool(trame[12], 5);
      appareil.RelaisFilActif = Utils.ByteVersBool(trame[12], 4);
      appareil.PompePlus = Utils.ByteVersBool(trame[13], 1);
      appareil.PompeMoins = Utils.ByteVersBool(trame[13], 0);
      appareil.CapteurTemp = Utils.ByteVersBool(trame[13], 2);
      appareil.CapteurSel = Utils.ByteVersBool(trame[13], 3);
      appareil.FlowSwitch |= Utils.ByteVersBool(trame[13], 4);
      appareil.PompeChlore = Utils.ByteVersBool(trame[13], 5);
      appareil.PompesForcees = Utils.ByteVersBool(trame[13], 7);
      appareil.RawFieldM13 = trame[13];
    }

    public static void ExtractionTrameS(byte[] trame, Appareil appareil)
    {
      appareil.valPh.Consigne = Utils.ByteVersDouble(trame[2], trame[3]) / 100.0;
      appareil.valPh.Seuils.Erreurs.Max = Utils.ByteVersDouble(trame[10], trame[11]) / 100.0;
      appareil.valPh.Seuils.Erreurs.Min = Utils.ByteVersDouble(trame[12], trame[13]) / 100.0;
    }

    public static void ExtractionTrameD(byte[] trame, Appareil appareil)
    {
      appareil.valTemp.Seuils.Erreurs.Min = (double) trame[5];
      appareil.valTemp.Seuils.Warnings.Min = (double) trame[7];
      appareil.valSel.Seuils.Warnings.Min = (double) trame[8] / 10.0;
      appareil.valSel.Seuils.Erreurs.Min = (double) trame[9] / 10.0;
    }

    public static void ExtractionTrameE(byte[] trame, Appareil appareil)
    {
      appareil.valRdx.Consigne = Utils.ByteVersDouble(trame[2], trame[3]);
      appareil.valAmp.Consigne = Utils.ByteVersDouble(trame[2], trame[3]) / 100.0;
      appareil.PinCodeSoft = (int) Utils.ByteVersUshort(trame[12], trame[13]);
    }

    public static void ExtractionTrameA(byte[] trame, Appareil appareil)
    {
      appareil.valElx.Valeur = (double) trame[2];
      appareil.valElx.Consigne = (double) trame[2];
      appareil.DureeBoost = (int) Utils.ByteVersDouble(trame[2], trame[3]);
      appareil.BoostActif = appareil.DureeBoost > 0;
      appareil.valElx.Volet = (int) trame[9];
      appareil.Salinite = (int) trame[10] & 3;
      appareil.VoletActif = Utils.ByteVersBool(trame[10], 4);
      appareil.VoletForcé = Utils.ByteVersBool(trame[10], 3);
      appareil.FlowSwitch |= Utils.ByteVersBool(trame[10], 2);
      appareil.AlarmeElx = (int) trame[12] & 15;
      appareil.Sleep = Utils.ByteVersBool(trame[13], 6) && Utils.ByteVersBool(trame[13], 5);
      appareil.Timer = Utils.ByteVersBool(trame[13], 7) && Utils.ByteVersBool(trame[13], 5);
      appareil.DureeST = (int) trame[13] & 31;
      appareil.RawFieldA10 = trame[10];
    }

    public static void ExtractionTrameJ(byte[] trame, Appareil appareil)
    {
    }

    public static void ExtractionTrameB(byte[] trame, Appareil appareil)
    {
    }

    public static async Task<byte[]> CompositionConsigne(
      double donnee,
      eMesures typemesure,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('S');
      switch (typemesure)
      {
        case eMesures.ph:
          trame[1] = (byte) 83;
          ushort mot1 = (ushort) (donnee * 100.0);
          trame[2] = Utils.HighByte(mot1);
          trame[3] = Utils.LowByte(mot1);
          break;
        case eMesures.redox:
          trame[1] = (byte) 69;
          ushort mot2 = (ushort) donnee;
          trame[2] = Utils.HighByte(mot2);
          trame[3] = Utils.LowByte(mot2);
          break;
      }
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      Globales.Regulateur.TramePrioritaire = (char) trame[1];
      return trame;
    }

    public static async Task<byte[]> CompositionOffset(
      double donnee,
      eMesures typemesure,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      switch (typemesure)
      {
        case eMesures.ph:
          ushort mot1 = (ushort) (donnee * 100.0);
          trame[2] = Utils.HighByte(mot1);
          trame[3] = Utils.LowByte(mot1);
          break;
        case eMesures.sel:
          ushort mot2 = (ushort) (donnee * 10.0);
          trame[8] = Utils.HighByte(mot2);
          trame[9] = Utils.LowByte(mot2);
          break;
        case eMesures.temp:
          ushort mot3 = (ushort) (donnee * 10.0);
          trame[6] = Utils.HighByte(mot3);
          trame[7] = Utils.LowByte(mot3);
          break;
        case eMesures.redox:
          ushort mot4 = (ushort) donnee;
          trame[4] = Utils.HighByte(mot4);
          trame[5] = Utils.LowByte(mot4);
          break;
      }
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionSeuils(
      sSeuils seuils,
      eMesures typemesure,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('D');
      if (typemesure == eMesures.ph)
        trame = Trames.TrameDonneesVide('S');
      switch (typemesure)
      {
        case eMesures.ph:
          ushort mot1 = (ushort) (seuils.Erreurs.Max * 100.0);
          ushort mot2 = (ushort) (seuils.Erreurs.Min * 100.0);
          trame[10] = Utils.HighByte(mot1);
          trame[11] = Utils.LowByte(mot1);
          trame[12] = Utils.HighByte(mot2);
          trame[13] = Utils.LowByte(mot2);
          break;
        case eMesures.sel:
          trame[8] = (byte) (seuils.Warnings.Min * 10.0);
          trame[9] = (byte) (seuils.Erreurs.Min * 10.0);
          break;
        case eMesures.temp:
          trame[4] = (byte) seuils.Erreurs.Max;
          trame[5] = (byte) seuils.Erreurs.Min;
          trame[6] = (byte) seuils.Warnings.Max;
          trame[7] = (byte) seuils.Warnings.Min;
          break;
      }
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      Globales.Regulateur.TramePrioritaire = (char) trame[1];
      return trame;
    }

    public static async Task<byte[]> CompositionValeurVolet(int volet, bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('A');
      trame[9] = (byte) volet;
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionActivationBoost(ushort boost, bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('A');
      trame[3] = Utils.HighByte(boost);
      trame[4] = Utils.LowByte(boost);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionActivationVolet(
      Appareil appareil,
      bool volet,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('A');
      trame[10] = Utils.ByteSet(volet, 3, appareil.RawFieldA10);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionProduction(int production, bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('A');
      trame[2] = (byte) production;
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionResetAlarmes(bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[10] = (byte) 207;
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionResetUsine(bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[14] = (byte) 207;
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionSetDate(bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('J');
      Utils.LongToByteArray(Utils.DateRegulateur(), out trame[6], out trame[7], out trame[8]);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionModele(int modele, bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[12] = (byte) modele;
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionPompes(
      Appareil appareil,
      int pompes,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[13] = (byte) ((uint) appareil.RawFieldM13 & 252U | (uint) (byte) (pompes + 1));
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionPompeChlore(
      Appareil appareil,
      int pompechlore,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[13] = Utils.ByteSet(pompechlore == 1, 5, appareil.RawFieldM13);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionSalinité(
      Appareil appareil,
      int salinité,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('A');
      trame[10] = (byte) ((uint) appareil.RawFieldA10 & 252U | (uint) (byte) salinité);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionMoteursForces(
      Appareil appareil,
      bool php,
      bool phm,
      bool chl,
      bool fil,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('D');
      trame[10] = Utils.ByteSet(php, 3, (byte) 0);
      trame[10] = Utils.ByteSet(phm, 2, trame[10]);
      trame[10] = Utils.ByteSet(chl, 1, trame[10]);
      trame[10] = Utils.ByteSet(fil, 0, trame[10]);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionCapteurs(
      Appareil appareil,
      bool sel,
      bool temp,
      bool flow,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('M');
      trame[13] = Utils.ByteSet(flow, 4, appareil.RawFieldM13);
      trame[13] = Utils.ByteSet(sel, 3, trame[13]);
      trame[13] = Utils.ByteSet(temp, 2, trame[13]);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    public static async Task<byte[]> CompositionCodePin(
      Appareil appareil,
      ushort codepin,
      bool fromIkare = false)
    {
      byte[] trame = Trames.TrameDonneesVide('E');
      trame[12] = Utils.HighByte(codepin);
      trame[13] = Utils.LowByte(codepin);
      if (!fromIkare)
      {
        string str = await BluetoothComm.BleWrite(trame, fromIkare);
      }
      return trame;
    }

    private static bool MnemoValide(char mnemo) => ((IEnumerable<char>) Constantes.MNEMONIQUES).Contains<char>(mnemo);

    public static byte[] TrameCommande(char mnemo)
    {
      if (!Trames.MnemoValide(mnemo))
        return (byte[]) null;
      byte[] table = new byte[6]
      {
        (byte) 42,
        (byte) 82,
        (byte) 63,
        (byte) mnemo,
        byte.MaxValue,
        (byte) 42
      };
      table[table.Length - 2] = Utils.Calcul_CRC(table, table.Length - 2);
      return table;
    }

    public static byte[] TrameDonneesVide(char mnemo)
    {
      if (!Trames.MnemoValide(mnemo))
        return (byte[]) null;
      byte[] numArray = new byte[17];
      numArray[0] = (byte) 42;
      numArray[1] = (byte) mnemo;
      for (int index = 2; index < 16; ++index)
        numArray[index] = byte.MaxValue;
      numArray[16] = (byte) 42;
      return numArray;
    }
  }
}
