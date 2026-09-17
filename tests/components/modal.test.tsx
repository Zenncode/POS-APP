import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "~/shared/components/ui/Modal";

function openModal(onClose = vi.fn()) {
  render(
    <Modal title="Pay" onClose={onClose}>
      <button>Confirm</button>
    </Modal>,
  );
  return {
    onClose,
    first: screen.getByRole("button", { name: "Close dialog" }),
    last: screen.getByRole("button", { name: "Confirm" }),
  };
}

describe("Modal", () => {
  it("Tab on the last focusable wraps back to the first", () => {
    const { first, last } = openModal();
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("Escape calls onClose", () => {
    const { onClose } = openModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the previously focused element on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <Modal title="Pay" onClose={vi.fn()}>
        <button>Confirm</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close dialog" }));
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
