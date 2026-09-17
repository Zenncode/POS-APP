import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "~/shared/components/ui/Modal";

describe("Modal — mutation killers", () => {
  // Kills: focus trap — Tab on last wraps to first
  it("Tab on last focusable wraps to first", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Pay" onClose={onClose}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    // The close button is first focusable, then First, then Last
    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);
  });

  // Kills: Shift+Tab on first wraps to last
  it("Shift+Tab on first focusable wraps to last", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Pay" onClose={onClose}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const closeBtn = screen.getByRole("button", { name: "Close dialog" });
    const last = screen.getByRole("button", { name: "Last" });
    closeBtn.focus();
    fireEvent.keyDown(closeBtn, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  // Kills: Escape key calls onClose
  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    render(<Modal title="Pay" onClose={onClose}><button>Confirm</button></Modal>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Kills: returnFocusOnClose returns focus to trigger
  it("returns focus to trigger on unmount when returnFocusOnClose=true", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<Modal title="Pay" onClose={vi.fn()} returnFocusOnClose={true}><button>Confirm</button></Modal>);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  // Kills: returnFocusOnClose=false does NOT return focus
  it("does NOT return focus when returnFocusOnClose=false", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<Modal title="Pay" onClose={vi.fn()} returnFocusOnClose={false}><button>Confirm</button></Modal>);
    unmount();
    expect(document.activeElement).not.toBe(trigger);
    trigger.remove();
  });

  // Kills: initialFocus ref focuses specific element
  it("initialFocus ref focuses that element on open", () => {
    const onClose = vi.fn();
    const inputRef = { current: null };
    render(
      <Modal title="Pay" onClose={onClose} initialFocus={inputRef}>
        <input ref={inputRef} />
      </Modal>
    );
    expect(document.activeElement).toBe(inputRef.current);
  });

  // Kills: wide prop applies max-w-2xl to sheet not backdrop
  it("wide=true applies max-w-2xl class to sheet", () => {
    render(<Modal title="Pay" onClose={vi.fn()} wide><button>Confirm</button></Modal>);
    const sheet = screen.getByRole("dialog").querySelector(".pos-sheet");
    expect(sheet).toHaveClass("max-w-2xl");
  });

  // Kills: close button click calls onClose
  it("close button click calls onClose", () => {
    const onClose = vi.fn();
    render(<Modal title="Pay" onClose={onClose}><button>Confirm</button></Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Kills: backdrop click calls onClose
  it("backdrop click calls onClose", () => {
    const onClose = vi.fn();
    render(<Modal title="Pay" onClose={onClose}><button>Confirm</button></Modal>);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});