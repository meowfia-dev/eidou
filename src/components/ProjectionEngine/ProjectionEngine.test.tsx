import '../../test/test-env';
import { describe, it, expect, afterEach } from "bun:test";
import { render, cleanup } from "../../test/utils";
import { ProjectionEngine } from "./ProjectionEngine";

describe("ProjectionEngine Hierarchy Strictness", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders ErrorGlitch when Projection child is NOT a field", () => {
    const invalidEuip = {
      type: "projection",
      props: { title: "Test Window" },
      children: [
        {
          type: "button",
          props: { label: "I am illegal", action: "illegal_click" },
        },
      ],
    };

    const { getByText, queryByText } = render(<ProjectionEngine node={invalidEuip} />);

    // Should find the hierarchy error message
    // Note: The message might be split across elements, so we look for part of it
    const errorMsg = getByText((content) => content.includes("Hierarchy Violation"));
    expect(errorMsg).toBeTruthy();
    
    // Should NOT see the button label
    const button = queryByText("I am illegal");
    expect(button).toBeNull();
  });

  it("renders correctly when Projection child IS a field", () => {
    const validEuip = {
      type: "projection",
      props: { title: "Test Window" },
      children: [
        {
          type: "field",
          props: {},
          children: [
            {
               type: "text",
               props: { content: "I am legal content" }
            }
          ]
        },
      ],
    };

    const { getByText } = render(<ProjectionEngine node={validEuip} />);

    // Should find the content inside the field
    const content = getByText("I am legal content");
    expect(content).toBeTruthy();
  });

  it("renders ErrorGlitch for unknown node types", () => {
    const unknownEuip = {
      type: "unknown_widget",
      props: {},
      children: [],
    };

    const { getByText } = render(<ProjectionEngine node={unknownEuip} />);

    // Should render the glitch error (type is uppercased via CSS, but text content is lowercase)
    const errorMsg = getByText((content) => content.includes("ERR_UNKNOWN_TYPE"));
    const typeMsg = getByText((content) => content.includes("unknown_widget"));
    
    expect(errorMsg).toBeTruthy();
    expect(typeMsg).toBeTruthy();
  });

  it("sanitizes dangerouslySetInnerHTML from props", () => {
    // We use 'text' because it spreads props to the underlying <p> tag, 
    // which would normally trigger a React error if both children (content) 
    // and dangerouslySetInnerHTML are provided.
    const maliciousEuip = {
      type: "text",
      props: {
        content: "Safe Content",
        dangerouslySetInnerHTML: { __html: "MALICIOUS" },
      },
      children: [],
    };

    const { getByText, queryByText } = render(<ProjectionEngine node={maliciousEuip} />);

    // Should render the safe content (implies dangerouslySetInnerHTML was removed)
    expect(getByText("Safe Content")).toBeTruthy();

    // Should NOT find the malicious content
    expect(queryByText("MALICIOUS")).toBeNull();
  });
});
