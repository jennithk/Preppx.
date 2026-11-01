export function gradeMultipleChoiceAnswer(
  selectedOption: number | null | undefined,
  correctOption: number | null,
  optionCount: number,
  marks: number,
) {
  if (selectedOption === null || selectedOption === undefined) return 0;
  if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= optionCount) return null;
  return selectedOption === correctOption ? marks : 0;
}
