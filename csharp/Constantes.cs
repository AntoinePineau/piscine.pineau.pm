// Decompiled with JetBrains decompiler
// Type: Corelec.Constantes
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using System;
using Xamarin.Forms;

namespace Corelec
{
  internal static class Constantes
  {
    public static string VERSION = "1.20";
    public static string PROFIL = "a";
    public static DateTime TIMEBASE_REGULATEUR = new DateTime(2015, 1, 1, 0, 0, 0, 0).ToLocalTime();
    public static string BT_DEMODEVICE = "DEMONSTRATION";
    public static string NO_MESURE = "----";
    public static int MESURE_TEXT = 46;
    public static double NOT_SET = -1.0;
    public static string NO_TRADUCTION = "_NO_TRAD_";
    public static Color COLOR_CONSIGNES = Color.Black;
    public static Color COLOR_REGLAGES_DIS = Color.Gray;
    public static Color COLOR_REGLAGES = Color.Maroon;
    public static Color COLOR_MESURES = Color.FromHex("209d7b");
    public static Color COLOR_UNITE = Color.FromHex("1c876b");
    public static Color COLOR_FRAME = Color.FromRgba(1.0, 1.0, 1.0, 0.85);
    public static Color COLOR_FRAME_MES = Color.FromRgba(1.0, 1.0, 1.0, 0.85);
    public static string PARAM_PRO = "PRO";
    public static string PARAM_LOGIN = "LOGIN";
    public static string PARAM_PASSWD = "PASSWD";
    public static string PARAM_PIN = "PINCode";
    public static char[] MNEMONIQUES = new char[7]
    {
      'M',
      'E',
      'S',
      'A',
      'D',
      'B',
      'J'
    };
    public static string WWW_URL = "http://corelec.0et1.fr/";
    public static string WWW_LOGIN = "index.php";
    public static string WWW_DEMANDE = "r_demande.php";
    public static string WWW_COMMANDE = "s_commande.php";
    public static string WWW_DONNEES = "r_donnees.php";
    public static string WWW_ERROR = "#ERROR#";
    public static string WWW_EMPTY = "#EMPTY#";
    public static double PAS_DE_REMONTEES = 1.2;
  }
}
