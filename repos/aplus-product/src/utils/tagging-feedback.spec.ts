import { taggingFeedbackAxesOf } from "./tagging-feedback";

describe("taggingFeedbackAxesOf", () => {
  it("returns both axes with the adjudicated spelling and the user's verdicts", () => {
    expect(
      taggingFeedbackAxesOf(
        { procedureLabel: "Demande RSA", blockageLabel: "detresse numerique" },
        { procedureIsCorrect: null, blockageIsCorrect: false },
      ),
    ).toEqual([
      { axis: "procedure", label: "demande rsa", isCorrect: null },
      {
        axis: "blockage",
        label: "détresse numérique",
        isCorrect: false,
      },
    ]);
  });

  it("omits the blockage axis when the model found no blockage", () => {
    expect(
      taggingFeedbackAxesOf(
        { procedureLabel: "demande rsa", blockageLabel: "Aucun" },
        null,
      ),
    ).toEqual([{ axis: "procedure", label: "demande rsa", isCorrect: null }]);
  });

  it("keeps a vote on a hidden axis out of the displayed ones", () => {
    expect(
      taggingFeedbackAxesOf(
        { procedureLabel: "demande rsa", blockageLabel: "aucun" },
        { procedureIsCorrect: true, blockageIsCorrect: false },
      ),
    ).toEqual([{ axis: "procedure", label: "demande rsa", isCorrect: true }]);
  });

  it("omits exits and unknown labels", () => {
    expect(
      taggingFeedbackAxesOf(
        { procedureLabel: "inconnu", blockageLabel: "déménagement" },
        null,
      ),
    ).toEqual([{ axis: "blockage", label: "déménagement", isCorrect: null }]);
    expect(
      taggingFeedbackAxesOf(
        { procedureLabel: null, blockageLabel: "pas dans la liste" },
        null,
      ),
    ).toEqual([]);
  });
});
