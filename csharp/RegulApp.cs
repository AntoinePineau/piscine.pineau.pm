// Decompiled with JetBrains decompiler
// Type: Corelec.RegulApp
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Corelec.Pages;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xamarin.Forms;

namespace Corelec
{
  public class RegulApp : Application
  {
    public NavigationPage NavPage;
    public MasterDetailPage MenuPage;
    public ContentPage StartPage;
    public List<IkareDevice> ListeDevicesIkar = new List<IkareDevice>();
    public List<BluetoothDevice> ListeDevicesBle = new List<BluetoothDevice>();
    public Dictionary<string, object> Parametres = new Dictionary<string, object>();

    public RegulApp()
    {
      Globales.RegAppXF = this;
      this.Profil();
      this.ChargeValeurs();
      Utils.eLangue = eLangues.FR;
      bool flag = (bool) this.Parametres[Constantes.PARAM_PRO];
      if (Globales.ForcePro)
        flag = true;
      if (Globales.ForceNormal)
        flag = false;
      if (flag)
        this.MainPage = (Page) new Ikare();
      else
        this.MainPage = (Page) new Bluetooth();
      Utils.Log("Application démarrée en langue: " + (object) Utils.eLangue + " Mode: " + (flag ? (object) "PRO" : (object) "NORMAL"));
    }

    private void Profil()
    {
      string profil = Constantes.PROFIL;
      if (!(profil == "a"))
      {
        if (!(profil == "b"))
        {
          if (!(profil == "x"))
            return;
          Globales.ForceWifi = true;
          Globales.ForceNormal = true;
          Globales.AllowHisto = true;
          Globales.PinCheat = true;
          Globales.DemoDevice = true;
        }
        else
        {
          Globales.PinCheat = true;
          Globales.ForcePro = true;
          Globales.AllowHisto = true;
        }
      }
      else
      {
        Globales.PinCheat = true;
        Globales.DemoDevice = true;
      }
    }

    private void ChargeValeurs()
    {
      this.Parametres.Clear();
      this.Parametres.Add(Constantes.PARAM_PRO, (object) false);
      this.Parametres.Add(Constantes.PARAM_PIN, (object) 0);
      this.Parametres.Add(Constantes.PARAM_LOGIN, (object) string.Empty);
      this.Parametres.Add(Constantes.PARAM_PASSWD, (object) string.Empty);
      if (!Application.Current.Properties.ContainsKey(Constantes.PARAM_PRO))
        Application.Current.Properties.Add(Constantes.PARAM_PRO, this.Parametres[Constantes.PARAM_PRO]);
      if (!Application.Current.Properties.ContainsKey(Constantes.PARAM_PIN))
        Application.Current.Properties.Add(Constantes.PARAM_PIN, this.Parametres[Constantes.PARAM_PIN]);
      if (!Application.Current.Properties.ContainsKey(Constantes.PARAM_LOGIN))
        Application.Current.Properties.Add(Constantes.PARAM_LOGIN, this.Parametres[Constantes.PARAM_LOGIN]);
      if (!Application.Current.Properties.ContainsKey(Constantes.PARAM_PASSWD))
        Application.Current.Properties.Add(Constantes.PARAM_PASSWD, this.Parametres[Constantes.PARAM_PASSWD]);
      this.Parametres[Constantes.PARAM_PRO] = Application.Current.Properties[Constantes.PARAM_PRO];
      this.Parametres[Constantes.PARAM_PIN] = Application.Current.Properties[Constantes.PARAM_PIN];
      this.Parametres[Constantes.PARAM_LOGIN] = Application.Current.Properties[Constantes.PARAM_LOGIN];
      this.Parametres[Constantes.PARAM_PASSWD] = Application.Current.Properties[Constantes.PARAM_PASSWD];
    }

    public async Task<bool> SauveValeurs(string btId = "__NOK", string btAlias = "__NOK")
    {
      bool flag = false;
      if ((bool) this.Parametres[Constantes.PARAM_PRO] != (bool) Application.Current.Properties[Constantes.PARAM_PRO])
      {
        flag = true;
        Application.Current.Properties[Constantes.PARAM_PRO] = this.Parametres[Constantes.PARAM_PRO];
      }
      if ((int) this.Parametres[Constantes.PARAM_PIN] != (int) Application.Current.Properties[Constantes.PARAM_PIN])
      {
        flag = true;
        Application.Current.Properties[Constantes.PARAM_PIN] = this.Parametres[Constantes.PARAM_PIN];
      }
      if ((string) this.Parametres[Constantes.PARAM_LOGIN] != (string) Application.Current.Properties[Constantes.PARAM_LOGIN])
      {
        flag = true;
        Application.Current.Properties[Constantes.PARAM_LOGIN] = this.Parametres[Constantes.PARAM_LOGIN];
      }
      if ((string) this.Parametres[Constantes.PARAM_PASSWD] != (string) Application.Current.Properties[Constantes.PARAM_PASSWD])
      {
        flag = true;
        Application.Current.Properties[Constantes.PARAM_PASSWD] = this.Parametres[Constantes.PARAM_PASSWD];
      }
      if (btId != "__NOK" && btAlias != "__NOK")
      {
        flag = true;
        if (Application.Current.Properties.ContainsKey(btId))
          Application.Current.Properties[btId] = (object) btAlias;
        else
          Application.Current.Properties.Add(btId, (object) btAlias);
      }
      if (flag)
        await Application.Current.SavePropertiesAsync();
      return true;
    }

    public async Task InitialisationRegulateur(
      BluetoothDevice btDevice,
      IkareDevice ikareDevice)
    {
      if (btDevice != null)
        Globales.Regulateur = new Appareil(btDevice);
      if (ikareDevice != null)
        Globales.Regulateur = new Appareil(ikareDevice);
      if (btDevice == null || btDevice.IsDemo)
        return;
      await BluetoothComm.HwBtOpen(btDevice);
    }

    public void LancementIHM()
    {
      this.MenuPage = new MasterDetailPage()
      {
        Master = (Page) new Menu()
      };
      if (Globales.Regulateur.Ikare)
        (this.MenuPage.Master as Menu).Identifiant = IkareDevice.Login;
      this.StartPage = (ContentPage) new Normal();
      this.NavPage = new NavigationPage((Page) this.StartPage);
      this.MenuPage.Detail = (Page) this.NavPage;
      this.MainPage = (Page) this.MenuPage;
      Utils.Log("BT selectionné, création MasterDetailsPage + NavPage");
    }

    protected override void OnStart()
    {
    }

    protected override void OnSleep()
    {
    }

    protected override void OnResume()
    {
    }
  }
}
