import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { SelectItem } from "@heroui/react";
import FormSelect from "./FormSelect";

const selectPropsHistory: Array<{
  selectedKeys: unknown;
  onSelectionChange?: (keys: unknown) => void;
}> = [];

vi.mock("@heroui/react", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@heroui/react");
  return {
    ...actual,
    Select: (props: Record<string, unknown>) => {
      selectPropsHistory.push({
        selectedKeys: props.selectedKeys,
        onSelectionChange: props.onSelectionChange as (keys: unknown) => void,
      });
      return <div data-testid="heroui-select">{props.children as React.ReactNode}</div>;
    },
  };
});

type TestForm = {
  demo: string;
  multi: string[];
};

function SingleSelectWrapper({ initialValue = "" }: { initialValue?: string }) {
  const { control, setValue } = useForm<TestForm>({
    defaultValues: { demo: initialValue, multi: [] },
  });

  useEffect(() => {
    setValue("demo", initialValue);
  }, [initialValue, setValue]);

  return (
    <FormSelect name="demo" control={control} aria-label="Demo">
      <SelectItem key="a">A</SelectItem>
      <SelectItem key="b">B</SelectItem>
    </FormSelect>
  );
}

const STABLE_MULTI_VALUE = ["a", "b"];

function MultiSelectWrapper() {
  const { control, setValue } = useForm<TestForm>({
    defaultValues: { demo: "", multi: STABLE_MULTI_VALUE },
  });

  useEffect(() => {
    setValue("multi", STABLE_MULTI_VALUE);
  }, [setValue]);

  return (
    <FormSelect name="multi" control={control} selectionMode="multiple" aria-label="Multi">
      <SelectItem key="a">A</SelectItem>
      <SelectItem key="b">B</SelectItem>
    </FormSelect>
  );
}

describe("FormSelect", () => {
  it("expone el valor simple como un Set estable", () => {
    selectPropsHistory.length = 0;
    const { rerender } = render(<SingleSelectWrapper initialValue="a" />);

    expect(screen.getByTestId("heroui-select")).toBeInTheDocument();
    expect(selectPropsHistory[selectPropsHistory.length - 1].selectedKeys).toBeInstanceOf(Set);
    expect(Array.from(selectPropsHistory[selectPropsHistory.length - 1].selectedKeys as Set<string>)).toEqual(["a"]);

    const firstKeys = selectPropsHistory[selectPropsHistory.length - 1].selectedKeys;
    rerender(<SingleSelectWrapper initialValue="a" />);
    const secondKeys = selectPropsHistory[selectPropsHistory.length - 1].selectedKeys;

    expect(secondKeys).toBe(firstKeys);
  });

  it("actualiza selectedKeys cuando cambia el valor del campo", () => {
    selectPropsHistory.length = 0;
    const { rerender } = render(<SingleSelectWrapper initialValue="a" />);
    expect(Array.from(selectPropsHistory[selectPropsHistory.length - 1].selectedKeys as Set<string>)).toEqual(["a"]);

    rerender(<SingleSelectWrapper initialValue="b" />);
    expect(Array.from(selectPropsHistory[selectPropsHistory.length - 1].selectedKeys as Set<string>)).toEqual(["b"]);
  });

  it("expone los valores múltiples como un Set estable", () => {
    selectPropsHistory.length = 0;
    const { rerender } = render(<MultiSelectWrapper />);

    const current = selectPropsHistory[selectPropsHistory.length - 1].selectedKeys as Set<string>;
    expect(Array.from(current)).toEqual(["a", "b"]);

    const firstKeys = selectPropsHistory[selectPropsHistory.length - 1].selectedKeys;
    rerender(<MultiSelectWrapper />);
    const secondKeys = selectPropsHistory[selectPropsHistory.length - 1].selectedKeys;

    expect(secondKeys).toBe(firstKeys);
  });
});
