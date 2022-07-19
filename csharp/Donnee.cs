// Decompiled with JetBrains decompiler
// Type: Corelec.Donnee
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using Corelec.Langues;

namespace Corelec
{
  public class Donnee
  {
    public sSeuils Seuils;
    public double Consigne;
    public double Valeur;
    public double Offset;
    public double DefaultCalibration1;
    public double DefaultCalibration2;
    public int Volet;
    public sMinMax SeuilsVolet;
    public sMinMax SeuilsProduction;
    public eMesures TypeMesure;
    public string Designation;
    public string Unité;

    public Donnee()
    {
    }

    public Donnee(eMesures cible)
    {
      this.TypeMesure = cible;
      switch (cible)
      {
        case eMesures.ph:
          this.Designation = Utils.Traduire(Langue.g_PH);
          this.Unité = Utils.Traduire(Langue.g_PH_unite);
          this.Seuils.Calibration.Min = 6.5;
          this.Seuils.Calibration.Max = 8.5;
          this.Seuils.Absolus.Min = 5.5;
          this.Seuils.Absolus.Max = 9.5;
          this.DefaultCalibration1 = 7.0;
          this.DefaultCalibration2 = 7.3;
          this.Seuils.Warnings.Min = 6.2;
          this.Seuils.Warnings.Max = 8.2;
          this.Seuils.Erreurs.Min = 5.2;
          this.Seuils.Erreurs.Max = 9.2;
          break;
        case eMesures.sel:
          this.Designation = Utils.Traduire(Langue.g_SEL);
          this.Unité = Utils.Traduire(Langue.g_SEL_unite);
          this.Seuils.Calibration.Min = 3.0;
          this.Seuils.Calibration.Max = 35.0;
          this.Seuils.Absolus.Min = 1.0;
          this.Seuils.Absolus.Max = 40.0;
          this.DefaultCalibration1 = 5.2;
          this.Seuils.Warnings.Min = 3.0;
          this.Seuils.Warnings.Max = 35.0;
          this.Seuils.Erreurs.Min = 2.2;
          this.Seuils.Erreurs.Max = 40.0;
          break;
        case eMesures.temp:
          this.Designation = Utils.Traduire(Langue.g_TEMP);
          this.Unité = Utils.Traduire(Langue.g_TEMP_unite);
          this.Seuils.Calibration.Min = 8.0;
          this.Seuils.Calibration.Max = 40.0;
          this.Seuils.Absolus.Min = 5.0;
          this.Seuils.Absolus.Max = 43.0;
          this.DefaultCalibration1 = 12.0;
          this.DefaultCalibration2 = 16.0;
          this.Seuils.Warnings.Min = 12.0;
          this.Seuils.Warnings.Max = 30.0;
          this.Seuils.Erreurs.Min = 8.0;
          this.Seuils.Erreurs.Max = 35.0;
          break;
        case eMesures.elx:
          this.Designation = Utils.Traduire(Langue.g_ELX);
          this.Unité = Utils.Traduire(Langue.g_ELX_unite);
          this.Seuils.Calibration.Min = 5.0;
          this.Seuils.Calibration.Max = 100.0;
          this.Seuils.Absolus.Min = 15.0;
          this.Seuils.Absolus.Max = 100.0;
          this.Seuils.Erreurs.Min = 5.0;
          this.Seuils.Erreurs.Max = 100.0;
          this.Seuils.Warnings.Min = 5.0;
          this.Seuils.Warnings.Max = 100.0;
          break;
        case eMesures.redox:
          this.Designation = Utils.Traduire(Langue.g_RDX);
          this.Unité = Utils.Traduire(Langue.g_RDX_unite);
          this.Seuils.Calibration.Min = 200.0;
          this.Seuils.Calibration.Max = 650.0;
          this.Seuils.Absolus.Min = 100.0;
          this.Seuils.Absolus.Max = 900.0;
          this.DefaultCalibration1 = 470.0;
          this.DefaultCalibration2 = 600.0;
          this.Seuils.Warnings.Min = 350.0;
          this.Seuils.Warnings.Max = 900.0;
          this.Seuils.Erreurs.Min = 300.0;
          this.Seuils.Erreurs.Max = 950.0;
          break;
        case eMesures.amp:
          this.Designation = Utils.Traduire(Langue.g_AMP);
          this.Unité = Utils.Traduire(Langue.g_AMP_unite);
          this.Seuils.Calibration.Min = 0.5;
          this.Seuils.Calibration.Max = 1.5;
          this.Seuils.Absolus.Min = 0.1;
          this.Seuils.Absolus.Max = 2.5;
          this.DefaultCalibration1 = 1.0;
          this.Seuils.Warnings.Min = 1.3;
          this.Seuils.Warnings.Max = 1.7;
          this.Seuils.Erreurs.Min = 0.5;
          this.Seuils.Erreurs.Max = 2.5;
          break;
      }
    }

    public Donnee Clone() => new Donnee()
    {
      TypeMesure = this.TypeMesure,
      SeuilsProduction = this.SeuilsProduction,
      SeuilsVolet = this.SeuilsVolet,
      Seuils = this.Seuils,
      Valeur = this.Valeur,
      Consigne = this.Consigne,
      Volet = this.Volet,
      Offset = this.Offset,
      DefaultCalibration1 = this.DefaultCalibration1,
      DefaultCalibration2 = this.DefaultCalibration2,
      Designation = this.Designation
    };
  }
}
