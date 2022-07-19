// Decompiled with JetBrains decompiler
// Type: Corelec.Utils
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Corelec.Langues;
using System;
using System.Globalization;

namespace Corelec
{
  public static class Utils
  {
    public static eLangues eLangue;

    public static string Traduire(string cible) => cible;

    public static string ModeleVersChaine(eRegulateurs app)
    {
      switch (app)
      {
        case eRegulateurs.Regul4Rx:
          return Utils.Traduire(Langue.g_Modele0);
        case eRegulateurs.Regul:
          return Utils.Traduire(Langue.g_Modele1);
        case eRegulateurs.Regul3:
          return Utils.Traduire(Langue.g_Modele2);
        case eRegulateurs.Duo:
          return Utils.Traduire(Langue.g_Modele3);
        case eRegulateurs.DuoRegul3:
          return Utils.Traduire(Langue.g_Modele4);
        case eRegulateurs.DuoRegul4Rx:
          return Utils.Traduire(Langue.g_Modele5);
        case eRegulateurs.DuoRegul4Amp:
          return Utils.Traduire(Langue.g_Modele6);
        default:
          return string.Empty;
      }
    }

    public static string MesureVersChaine(eMesures mes)
    {
      switch (mes)
      {
        case eMesures.ph:
          return Utils.Traduire(Langue.g_PH);
        case eMesures.sel:
          return Utils.Traduire(Langue.g_SEL);
        case eMesures.temp:
          return Utils.Traduire(Langue.g_TEMP);
        case eMesures.elx:
          return Utils.Traduire(Langue.g_ELX);
        case eMesures.redox:
          return Utils.Traduire(Langue.g_RDX);
        case eMesures.amp:
          return Utils.Traduire(Langue.g_AMP);
        default:
          return string.Empty;
      }
    }

    public static string ValeurFormatee(eMesures typeMes, double val)
    {
      switch (typeMes)
      {
        case eMesures.ph:
        case eMesures.amp:
          return string.Format("{0:0.00}", new object[1]
          {
            (object) val
          });
        case eMesures.sel:
        case eMesures.temp:
          return string.Format("{0:0.0}", new object[1]
          {
            (object) val
          });
        default:
          return string.Format("{0:0}", new object[1]
          {
            (object) val
          });
      }
    }

    public static void Log(string texte, int device = 0)
    {
    }

    public static byte Calcul_CRC(byte[] table, int count)
    {
      byte num = 0;
      for (int index = 0; index < count; ++index)
        num ^= table[index];
      return num;
    }

    public static ushort ByteVersUshort(byte msb, byte lsb) => (ushort) ((uint) msb * 256U + (uint) lsb);

    public static double ByteVersDouble(byte msb, byte lsb) => (double) msb * 256.0 + (double) lsb;

    public static bool ByteVersBool(byte cible, int bit)
    {
      double num = Math.Pow(2.0, (double) bit);
      cible &= (byte) num;
      return cible != (byte) 0;
    }

    public static byte ByteSet(bool valeur, int position, byte cible)
    {
      byte num1 = (byte) (1U << position);
      byte num2 = ~num1;
      if (valeur)
        cible |= num1;
      else
        cible &= num2;
      return cible;
    }

    public static byte HighByte(ushort mot) => (byte) ((uint) mot >> 8);

    public static byte LowByte(ushort mot) => (byte) ((uint) mot & (uint) byte.MaxValue);

    public static void LongToByteArray(uint val, out byte bmsb, out byte bmid, out byte blsb)
    {
      bmsb = (byte) (val >> 16 & (uint) byte.MaxValue);
      bmid = (byte) (val >> 8 & (uint) byte.MaxValue);
      blsb = (byte) (val & (uint) byte.MaxValue);
    }

    public static int CalculePin(string btAddress) => int.Parse(btAddress.Substring(9, 3), NumberStyles.HexNumber) * 2;

    public static uint DateRegulateur()
    {
      DateTime timebaseRegulateur = Constantes.TIMEBASE_REGULATEUR;
      return (uint) ((DateTime.Now.ToLocalTime() - timebaseRegulateur).TotalSeconds / 60.0);
    }

    public static long DtVersTs(DateTime dt)
    {
      DateTime dateTime = new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc);
      return (dt.ToUniversalTime() - dateTime).Ticks / 10000000L;
    }
  }
}
