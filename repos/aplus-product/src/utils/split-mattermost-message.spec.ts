import {
  MATTERMOST_MAX_POST_LENGTH,
  splitMattermostMessage,
} from "./split-mattermost-message";

const TABLE_HEADER = "| # | ID | Action |\n|:---:|:---|:---|";

function tableMessage(rowCount: number): string {
  const rows = Array.from(
    { length: rowCount },
    (_, index) =>
      `| ${index + 1} | \`${String(index).padStart(8, "0")}...\` | [Voir le signalement](https://exemple.test/signalement/${index}) |`,
  );
  return ["**CRON - Titre**", "", "> résumé", "", TABLE_HEADER, ...rows].join(
    "\n",
  );
}

describe("splitMattermostMessage", () => {
  it("laisse intact un message court", () => {
    expect(splitMattermostMessage("**Titre**\n\ncorps")).toEqual([
      "**Titre**\n\ncorps",
    ]);
  });

  it("découpe un long tableau en posts lisibles chacun", () => {
    const posts = splitMattermostMessage(tableMessage(400));

    expect(posts.length).toBeGreaterThan(1);
    for (const post of posts) {
      expect(post.length).toBeLessThanOrEqual(MATTERMOST_MAX_POST_LENGTH);
      expect(post).toContain(TABLE_HEADER);
    }
    expect(posts[1].startsWith("**CRON - Titre** _(suite)_")).toBe(true);
  });

  it("ne perd ni ne duplique aucune ligne", () => {
    const posts = splitMattermostMessage(tableMessage(400));
    const rows = posts.join("\n").match(/Voir le signalement/g);

    expect(rows).toHaveLength(400);
  });

  it("n'ajoute pas l'en-tête de tableau hors d'un tableau", () => {
    const message = ["**Titre**", "", ...Array(50).fill("x".repeat(80))].join(
      "\n",
    );
    const posts = splitMattermostMessage(message, 1000);

    expect(posts.length).toBeGreaterThan(1);
    expect(
      posts[1].startsWith(`**Titre** _(suite)_\n\n${"x".repeat(80)}`),
    ).toBe(true);
    expect(posts.join("\n")).not.toContain("|");
  });

  it("coupe une ligne unique plus longue que la limite", () => {
    const posts = splitMattermostMessage(
      `**Titre**\n${"y".repeat(5000)}`,
      1000,
    );

    for (const post of posts) expect(post.length).toBeLessThanOrEqual(1000);
    expect(posts.join("").replace(/[^y]/g, "")).toHaveLength(5000);
  });
});
