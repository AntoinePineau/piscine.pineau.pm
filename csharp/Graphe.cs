// Decompiled with JetBrains decompiler
// Type: Corelec.Graphe
// Assembly: Corelec, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null
// MVID: 3005E24C-B811-45B2-80E1-90423401CE01
// Assembly location: C:\softs\dex2jar-2.0\regulapp\assemblies\Corelec.dll

using OxyPlot;
using OxyPlot.Axes;
using OxyPlot.Series;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Corelec
{
  internal class Graphe
  {
    public PlotModel plotModel;
    private double echelleYmin;
    private double echelleYmax = 100.0;
    private eMesures typeMesure;
    private bool avecConsigne;
    private DateTimeAxis xaxis;
    private LinearAxis yaxis;
    private LineSeries pointsMesures;
    private LineSeries pointsConsigne;

    public Graphe(eMesures quoi)
    {
      this.typeMesure = quoi;
      switch (quoi)
      {
        case eMesures.ph:
          this.echelleYmin = 5.0;
          this.echelleYmax = 10.0;
          this.avecConsigne = true;
          break;
        case eMesures.sel:
          this.echelleYmin = 1.0;
          this.echelleYmax = 8.0;
          break;
        case eMesures.temp:
          this.echelleYmin = 5.0;
          this.echelleYmax = 35.0;
          break;
        case eMesures.elx:
          this.echelleYmin = 5.0;
          this.echelleYmax = 120.0;
          break;
        case eMesures.redox:
          this.echelleYmin = 200.0;
          this.echelleYmax = 1000.0;
          this.avecConsigne = true;
          break;
        case eMesures.amp:
          this.echelleYmin = 0.1;
          this.echelleYmax = 2.0;
          this.avecConsigne = true;
          break;
      }
    }

    private void Initialisation(int heures)
    {
      this.plotModel = new PlotModel()
      {
        Title = string.Format("Evolution jusqu'à {0}h", new object[1]
        {
          (object) heures
        })
      };
      DateTimeAxis dateTimeAxis = new DateTimeAxis();
      dateTimeAxis.Position = AxisPosition.Bottom;
      dateTimeAxis.StringFormat = string.Format("dd/MM HH:mm");
      this.xaxis = dateTimeAxis;
      LinearAxis linearAxis = new LinearAxis();
      linearAxis.Position = AxisPosition.Left;
      linearAxis.Minimum = this.echelleYmin;
      linearAxis.Maximum = this.echelleYmax;
      this.yaxis = linearAxis;
      this.plotModel.Axes.Add((Axis) this.xaxis);
      this.plotModel.Axes.Add((Axis) this.yaxis);
      this.pointsMesures = new LineSeries()
      {
        StrokeThickness = 3.0
      };
      this.pointsConsigne = new LineSeries()
      {
        StrokeThickness = 2.0
      };
    }

    public async Task<bool> SelectionMesuresRegulateur(int heures)
    {
      bool flag;
      return flag;
    }

    public async Task<bool> SelectionMesuresIkare(int heures)
    {
      this.Initialisation(heures);
      List<mesuresWWW> mesuresWwwList = new List<mesuresWWW>();
      foreach (mesuresWWW data in Site.Parse_Datas(await Site.Reception_Donnees(this.typeMesure, DateTime.Now.AddDays(-2.0))))
      {
        double x = DateTimeAxis.ToDouble(data.xTms);
        this.pointsMesures.Points.Add(new DataPoint(x, data.xVal));
        this.pointsConsigne.Points.Add(new DataPoint(x, data.xCon));
      }
      if (this.avecConsigne)
        this.plotModel.Series.Add((OxyPlot.Series.Series) this.pointsConsigne);
      this.plotModel.Series.Add((OxyPlot.Series.Series) this.pointsMesures);
      return true;
    }

    public async Task<bool> SimulationMesures(int heures, double valeur, double consigne)
    {
      this.Initialisation(heures);
      Random random = new Random();
      double y = valeur;
      DateTime now = DateTime.Now;
      this.pointsConsigne.Points.Add(new DataPoint(DateTimeAxis.ToDouble(now), consigne));
      this.pointsMesures.Points.Add(new DataPoint(DateTimeAxis.ToDouble(now), y));
      for (double num1 = 6.0; num1 <= (double) heures; num1 += 6.0)
      {
        double num2 = random.NextDouble() - 0.5;
        y += num2 * (valeur / 5.0);
        DateTime dateTime = now.AddHours(-num1);
        this.pointsMesures.Points.Add(new DataPoint(DateTimeAxis.ToDouble(dateTime), y));
        this.pointsConsigne.Points.Add(new DataPoint(DateTimeAxis.ToDouble(dateTime), consigne));
      }
      if (this.avecConsigne)
        this.plotModel.Series.Add((OxyPlot.Series.Series) this.pointsConsigne);
      this.plotModel.Series.Add((OxyPlot.Series.Series) this.pointsMesures);
      return true;
    }
  }
}
