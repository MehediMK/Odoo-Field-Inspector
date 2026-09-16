/** Odoo domain serialization. No evaluation of user-provided expressions. */
(function () {
  window.__FI__ = window.__FI__ || {};
  if (window.__FI__.domain) return;

  const operators = ["=", "!=", ">", ">=", "<", "<=", "ilike", "not ilike", "like", "not like", "in", "not in", "is set", "is not set"];
  const fieldPattern = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

  function scalar(text, type) {
    if (type === "boolean") {
      if (text === "true") return true;
      if (text === "false") return false;
      throw new Error("Choose True or False.");
    }
    if (type === "number" || type === "integer") {
      const number = Number(text);
      if (!String(text).trim() || !Number.isFinite(number)) throw new Error("Enter a valid number.");
      if (type === "integer" && !Number.isSafeInteger(number)) throw new Error("Enter a whole number within the supported range.");
      return number;
    }
    if (type === "date" || type === "datetime") {
      const pattern = type === "date" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      const date = String(text).slice(0, 10);
      const parsed = new Date(date + "T00:00:00Z");
      if (!pattern.test(text) || date.startsWith("0000") || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error(type === "date" ? "Use a valid date: YYYY-MM-DD." : "Use a valid UTC datetime: YYYY-MM-DD HH:mm:ss.");
      }
      if (type === "datetime") {
        const [hour, minute, second] = text.slice(11).split(":").map(Number);
        if (hour > 23 || minute > 59 || second > 59) throw new Error("Enter a valid UTC time.");
      }
    }
    return String(text);
  }

  function condition(rule) {
    const field = String(rule.field || "").trim();
    if (!fieldPattern.test(field)) throw new Error("Enter a technical field name (for example, partner_id.name).");
    if (!operators.includes(rule.operator)) throw new Error("Choose a supported operator.");
    if (rule.operator === "is set") return [field, "!=", false];
    if (rule.operator === "is not set") return [field, "=", false];
    if (["like", "not like", "ilike", "not ilike"].includes(rule.operator) && rule.type !== "text") {
      throw new Error("Text matching requires a text value.");
    }
    if ([">", ">=", "<", "<="].includes(rule.operator) && rule.type === "boolean") {
      throw new Error("Use equals or not equals for boolean values.");
    }
    let value;
    if (rule.operator === "in" || rule.operator === "not in") {
      try { value = JSON.parse(rule.value); } catch (_) { throw new Error('Enter a JSON list, for example [1, 2] or ["draft", "done"].'); }
      if (!Array.isArray(value)) throw new Error("Membership operators require a JSON list.");
      value = value.map((item) => {
        if (item === null || typeof item === "object") throw new Error("List values must be text, numbers, or booleans.");
        const expected = rule.type === "boolean" ? "boolean" : ["number", "integer"].includes(rule.type) ? "number" : "string";
        if (typeof item !== expected) throw new Error(`List items must match the selected value type (${rule.type}).`);
        return scalar(String(item), rule.type);
      });
    } else {
      value = scalar(rule.value, rule.type);
    }
    return [field, rule.operator, value];
  }

  function python(value) {
    if (value === true) return "True";
    if (value === false) return "False";
    if (Array.isArray(value)) return "[" + value.map(python).join(", ") + "]";
    return JSON.stringify(value);
  }

  function build(rules, match = "all") {
    if (match !== "all" && match !== "any") throw new Error("Choose Match all or Match any.");
    const conditions = rules.map((rule, index) => {
      try { return condition(rule); } catch (error) { throw new Error(`Condition ${index + 1}: ${error.message}`); }
    });
    const prefix = conditions.length > 1 ? Array(conditions.length - 1).fill(match === "all" ? "&" : "|") : [];
    const domain = [...prefix, ...conditions];
    const expression = "[" + [
      ...prefix.map(python),
      ...conditions.map(([field, operator, value]) => `(${python(field)}, ${python(operator)}, ${python(value)})`),
    ].join(", ") + "]";
    return { domain, python: expression, json: JSON.stringify(domain, null, 2) };
  }

  window.__FI__.domain = { operators, build };
})();
