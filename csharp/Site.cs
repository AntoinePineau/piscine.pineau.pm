// Decompiled with JetBrains decompiler
// Type: Corelec.Site
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Threading.Tasks;

namespace Corelec
{
  public class Site
  {
    public static async Task<bool> Validation_Login(string user, string password)
    {
      HttpResponseMessage async = await new HttpClient().GetAsync(string.Format("{0}/{1}?", new object[2]
      {
        (object) Constantes.WWW_URL,
        (object) Constantes.WWW_LOGIN
      }) + string.Format("flogin={0}&fpass={1}", new object[2]
      {
        (object) user.Trim(),
        (object) password
      }));
      async.EnsureSuccessStatusCode();
      return !(await async.Content.ReadAsStringAsync()).Contains("badlog");
    }

    public static async Task<string> Emission_Commande(eCommandesIkare cible, string valeur)
    {
      HttpResponseMessage async = await new HttpClient().GetAsync(string.Format("{0}/{1}?", new object[2]
      {
        (object) Constantes.WWW_URL,
        (object) Constantes.WWW_COMMANDE
      }) + string.Format("app={0}&com={1}&val={2}", new object[3]
      {
        (object) Globales.Regulateur.BluetoothId,
        (object) (int) cible,
        (object) valeur
      }));
      async.EnsureSuccessStatusCode();
      return await async.Content.ReadAsStringAsync();
    }

    public static async Task<string> Reception_Appareils(string user, string password)
    {
      HttpResponseMessage async = await new HttpClient().GetAsync(string.Format("{0}/{1}?", new object[2]
      {
        (object) Constantes.WWW_URL,
        (object) Constantes.WWW_DEMANDE
      }) + string.Format("flogin={0}&fpass={1}", new object[2]
      {
        (object) user.Trim(),
        (object) password
      }));
      async.EnsureSuccessStatusCode();
      return await async.Content.ReadAsStringAsync();
    }

    public static async Task<string> Reception_Donnees(eMesures mesure, DateTime depart)
    {
      HttpClient httpClient = new HttpClient();
      string str1 = string.Format("{0}/{1}?", new object[2]
      {
        (object) Constantes.WWW_URL,
        (object) Constantes.WWW_DONNEES
      });
      long num = Utils.DtVersTs(depart);
      string str2 = string.Format("app={0}&cib={1}&tms={2}", new object[3]
      {
        (object) Globales.Regulateur.BluetoothId,
        (object) (int) mesure,
        (object) num
      });
      HttpResponseMessage async = await httpClient.GetAsync(str1 + str2);
      async.EnsureSuccessStatusCode();
      return await async.Content.ReadAsStringAsync();
    }

    public static bool Parse_Demande(string contenu)
    {
      if (contenu.Contains(Constantes.WWW_ERROR))
        return false;
      List<string> stringList = new List<string>();
      string str1 = contenu;
      char[] chArray = new char[1]{ '}' };
      foreach (string str2 in str1.Split(chArray))
      {
        if (!string.IsNullOrEmpty(str2))
          stringList.Add(str2 + "}");
      }
      foreach (string str3 in stringList)
      {
        appareilsWWW appareilsWww = JsonConvert.DeserializeObject<appareilsWWW>(str3);
        IkareDevice ikareDevice = new IkareDevice()
        {
          wwwREGUL = appareilsWww
        };
        Globales.RegAppXF.ListeDevicesIkar.Add(ikareDevice);
      }
      return true;
    }

    public static List<mesuresWWW> Parse_Datas(string contenu)
    {
      if (contenu.Contains(Constantes.WWW_ERROR) || contenu.Contains(Constantes.WWW_EMPTY))
        return (List<mesuresWWW>) null;
      List<mesuresWWW> mesuresWwwList = new List<mesuresWWW>();
      List<string> stringList = new List<string>();
      string str1 = contenu;
      char[] chArray = new char[1]{ '}' };
      foreach (string str2 in str1.Split(chArray))
      {
        if (!string.IsNullOrEmpty(str2))
          stringList.Add(str2 + "}");
      }
      foreach (string str3 in stringList)
      {
        mesuresWWW mesuresWww = JsonConvert.DeserializeObject<mesuresWWW>(str3);
        mesuresWwwList.Add(mesuresWww);
      }
      return mesuresWwwList;
    }

    public static commandeWWW Parse_Cde(string contenu)
    {
      if (contenu.Contains(Constantes.WWW_ERROR) || contenu.Contains(Constantes.WWW_EMPTY))
        return (commandeWWW) null;
      contenu = contenu.Replace("[", "").Replace("]", "");
      return JsonConvert.DeserializeObject<commandeWWW>(contenu);
    }

    public static async Task<bool> CompositionConsigne(double consigne, eMesures type)
    {
      eCommandesIkare webCde;
      switch (type)
      {
        case eMesures.redox:
          webCde = eCommandesIkare.consigne_redox;
          break;
        case eMesures.amp:
          webCde = eCommandesIkare.consigne_ampero;
          break;
        default:
          webCde = eCommandesIkare.consigne_pH;
          break;
      }
      CultureInfo invariantCulture = CultureInfo.InvariantCulture;
      object[] objArray = new object[1]{ (object) consigne };
      string str = await Site.Emission_Commande(webCde, string.Format((IFormatProvider) invariantCulture, "{0:0.00}", objArray));
      return true;
    }

    public static async Task<bool> CompositionResetAlarmes()
    {
      string str = await Site.Emission_Commande(eCommandesIkare.reset_alarmes, "0xCF");
      return true;
    }

    public static async Task<bool> CompositionResetUsine()
    {
      string str = await Site.Emission_Commande(eCommandesIkare.reset_usine, "0xCF");
      return true;
    }

    public static async Task<bool> CompositionProduction(int production)
    {
      string str = await Site.Emission_Commande(eCommandesIkare.production, string.Format((IFormatProvider) CultureInfo.InvariantCulture, "{0}", new object[1]
      {
        (object) production
      }));
      return true;
    }

    public static async Task<bool> CompositionMoteursForces(
      bool php,
      bool phm,
      bool elx,
      bool fil)
    {
      string str = await Site.Emission_Commande(eCommandesIkare.moteurs_forces, string.Format("{0:0000}", new object[1]
      {
        (object) ((php ? 1000 : 0) + (phm ? 100 : 0) + (elx ? 10 : 0) + (fil ? 1 : 0))
      }));
      return true;
    }
  }
}
