import { getReportAreaFromApplicantTeam } from "./report-area";

describe("getReportAreaFromApplicantTeam", () => {
  it("retient le seul territoire de l'équipe", () => {
    expect(
      getReportAreaFromApplicantTeam([
        { id: "66", name: "Pyrénées-Orientales" },
      ]),
    ).toEqual({ id: "66", name: "Pyrénées-Orientales" });
  });

  it("retient le premier par ordre alphabétique quel que soit l'ordre reçu", () => {
    const areas = [
      { id: "66", name: "Pyrénées-Orientales" },
      { id: "11", name: "Aude" },
      { id: "34", name: "Hérault" },
    ];
    expect(getReportAreaFromApplicantTeam(areas)?.id).toBe("11");
    expect(getReportAreaFromApplicantTeam([...areas].reverse())?.id).toBe("11");
  });

  it("ne modifie pas le tableau reçu", () => {
    const areas = [
      { id: "66", name: "Pyrénées-Orientales" },
      { id: "11", name: "Aude" },
    ];
    getReportAreaFromApplicantTeam(areas);
    expect(areas[0].id).toBe("66");
  });

  it("renvoie undefined pour une équipe sans territoire", () => {
    expect(getReportAreaFromApplicantTeam([])).toBeUndefined();
  });
});
