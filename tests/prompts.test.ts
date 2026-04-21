import "./setup"
import { describe, expect, test } from "bun:test"
import { parsePromptRef, interpolate, templateByteSize, PROMPT_MAX_TEMPLATE_BYTES } from "@/lib/prompts"

describe("parsePromptRef", () => {
  test("bare slug resolves to latest", () => {
    expect(parsePromptRef("customer-support")).toEqual({ kind: "slug", slug: "customer-support", version: null })
  })

  test("slug@version pins a version", () => {
    expect(parsePromptRef("customer-support@7")).toEqual({ kind: "slug", slug: "customer-support", version: 7 })
  })

  test("prm_<id> resolves by primary key", () => {
    expect(parsePromptRef("prm_abc123")).toEqual({ kind: "id", id: "prm_abc123" })
  })

  test("@non-integer version falls back to latest of literal slug", () => {
    const r = parsePromptRef("weird@notanumber")
    expect(r.kind).toBe("slug")
    if (r.kind === "slug") {
      expect(r.slug).toBe("weird@notanumber")
      expect(r.version).toBeNull()
    }
  })

  test("@0 is rejected as a valid version", () => {
    const r = parsePromptRef("x@0")
    expect(r.kind).toBe("slug")
    if (r.kind === "slug") expect(r.version).toBeNull()
  })

  test("slug may contain intermediate @", () => {
    const r = parsePromptRef("a@b@3")
    expect(r).toEqual({ kind: "slug", slug: "a@b", version: 3 })
  })
})

describe("interpolate", () => {
  const template = [
    { role: "system", content: "You are a {{tone}} assistant." },
    { role: "user", content: "Summarise in {{max_bullets}} bullets." },
  ]

  test("replaces placeholders with caller-supplied vars", () => {
    const out = interpolate(template, { tone: "friendly", max_bullets: "5" }, {})
    expect((out[0] as any).content).toBe("You are a friendly assistant.")
    expect((out[1] as any).content).toBe("Summarise in 5 bullets.")
  })

  test("uses defaults when caller did not supply a var", () => {
    const out = interpolate(template, { max_bullets: "3" }, { tone: "concise" })
    expect((out[0] as any).content).toBe("You are a concise assistant.")
    expect((out[1] as any).content).toBe("Summarise in 3 bullets.")
  })

  test("caller vars override defaults", () => {
    const out = interpolate(template, { tone: "formal" }, { tone: "casual" })
    expect((out[0] as any).content).toBe("You are a formal assistant.")
  })

  test("leaves literal placeholder when variable is missing (debug signal)", () => {
    const out = interpolate(template, {}, {})
    expect((out[0] as any).content).toBe("You are a {{tone}} assistant.")
  })

  test("tolerates whitespace inside placeholders", () => {
    const t = [{ role: "user", content: "Hello {{  name  }}" }]
    const out = interpolate(t, { name: "world" }, {})
    expect((out[0] as any).content).toBe("Hello world")
  })

  test("replaces inside array-of-parts content (multimodal text parts)", () => {
    const t = [{
      role: "user",
      content: [
        { type: "text", text: "Describe {{subject}}" },
        { type: "image_url", image_url: { url: "https://x" } },
      ],
    }]
    const out = interpolate(t, { subject: "this logo" }, {})
    const parts = (out[0] as any).content
    expect(parts[0]).toEqual({ type: "text", text: "Describe this logo" })
    expect(parts[1]).toEqual({ type: "image_url", image_url: { url: "https://x" } })
  })

  test("preserves non-content fields", () => {
    const t = [{ role: "assistant", content: "hi {{name}}", name: "bot" }]
    const out = interpolate(t, { name: "alice" }, {})
    expect(out[0]).toEqual({ role: "assistant", content: "hi alice", name: "bot" })
  })

  test("does not mutate the original template", () => {
    const t = [{ role: "system", content: "hi {{x}}" }]
    const out = interpolate(t, { x: "there" }, {})
    expect((t[0] as any).content).toBe("hi {{x}}")
    expect((out[0] as any).content).toBe("hi there")
  })

  test("ignores unknown placeholder syntax", () => {
    const t = [{ role: "user", content: "{single} ${dollar} {{ok}} {{}}" }]
    const out = interpolate(t, { ok: "yes" }, {})
    expect((out[0] as any).content).toBe("{single} ${dollar} yes {{}}")
  })
})

describe("templateByteSize", () => {
  test("returns a byte count", () => {
    expect(templateByteSize([{ role: "user", content: "hi" }])).toBeGreaterThan(0)
  })

  test("max template byte limit is exported and reasonable", () => {
    expect(PROMPT_MAX_TEMPLATE_BYTES).toBeGreaterThanOrEqual(32 * 1024)
  })
})
