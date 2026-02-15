import React, { useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import { useI18n } from "../context/I18nContext";

export type Filters = {
  q: string;
  priceMin: string;
  priceMax: string;
  categories: string[];
  tags: string[];
};

export function FilterPanel({
  value,
  onChange
}: {
  value: Filters;
  onChange: (v: Filters) => void;
}) {
  const { t } = useI18n();
  const [allCats, setAllCats] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [catInput, setCatInput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setAllCats(await api.listCategories());
        setAllTags(await api.listTags());
      } catch {
        // ignore
      }
    })();
  }, []);

  const selectedCats = useMemo(() => new Set(value.categories.map((x) => x.toLowerCase())), [value.categories]);
  const selectedTags = useMemo(() => new Set(value.tags.map((x) => x.toLowerCase())), [value.tags]);

  function toggle(list: string[], name: string) {
    const exists = list.some((x) => x.toLowerCase() === name.toLowerCase());
    return exists ? list.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...list, name];
  }

  function addManual(kind: "cat" | "tag", raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (kind === "cat") {
      onChange({ ...value, categories: toggle(value.categories, name) });
      setCatInput("");
    } else {
      onChange({ ...value, tags: toggle(value.tags, name) });
      setTagInput("");
    }
  }

  return (
    <div className="glass-soft" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700 }}>{t("filter.title")}</div>
        <button
          className="btn"
          onClick={() => onChange({ q: "", priceMin: "", priceMax: "", categories: [], tags: [] })}
        >
          {t("filter.reset")}
        </button>
      </div>

      <div className="hr" />

      <div className="col">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {t("filter.searchLabel")}
          </div>
          <input
            className="input"
            placeholder={t("filter.searchPlaceholder")}
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
          />
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {t("filter.priceFrom")}
            </div>
            <input
              className="input"
              placeholder="0"
              value={value.priceMin}
              onChange={(e) => onChange({ ...value, priceMin: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {t("filter.priceTo")}
            </div>
            <input
              className="input"
              placeholder="999999"
              value={value.priceMax}
              onChange={(e) => onChange({ ...value, priceMax: e.target.value })}
            />
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("filter.categoriesTitle")}</div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {allCats.map((c) => {
              const on = selectedCats.has(c.toLowerCase());
              return (
                <button
                  key={c}
                  className={`btn ${on ? "primary" : ""}`}
                  onClick={() => onChange({ ...value, categories: toggle(value.categories, c) })}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              placeholder={t("filter.manualCategoryPlaceholder")}
              value={catInput}
              onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addManual("cat", catInput);
              }}
            />
            <button className="btn" onClick={() => addManual("cat", catInput)}>
              +
            </button>
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("filter.tagsTitle")}</div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {allTags.slice(0, 60).map((tag) => {
              const on = selectedTags.has(tag.toLowerCase());
              return (
                <button
                  key={tag}
                  className={`btn ${on ? "primary" : ""}`}
                  onClick={() => onChange({ ...value, tags: toggle(value.tags, tag) })}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              placeholder={t("filter.manualTagPlaceholder")}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addManual("tag", tagInput);
              }}
            />
            <button className="btn" onClick={() => addManual("tag", tagInput)}>
              +
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {t("filter.hint")}
          </div>
        </div>
      </div>
    </div>
  );
}
