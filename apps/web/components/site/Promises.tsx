/** What the product guarantees, in the reader's terms rather than ours. */
const PROMISES = [
  {
    title: "You will not lose it",
    body: "It saves while you type, not when you remember to. Close the tab mid-word,"
      + " drop the phone, run flat at the gate — the words were already somewhere safe,"
      + " and they are on your other devices too.",
  },
  {
    title: "Your handwriting is searchable",
    body: "Write a page by hand in March and find it in November by one word in it."
      + " So can Claude. Everywhere else, handwriting hands an agent a picture and"
      + " a shrug.",
  },
  {
    title: "Nothing is rewritten behind your back",
    body: "When Claude adds something it says so, in its own colour, with its name on"
      + " it. If you do not like what it did, one tap puts the note back the way it was.",
  },
];

export function Promises() {
  return (
    <section className="jd-band jd-band-quiet">
      <h2 className="font-head">What you can count on</h2>
      <div className="jd-cards">
        {PROMISES.map((promise) => (
          <article key={promise.title}>
            <h3 className="font-head">{promise.title}</h3>
            <p>{promise.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
