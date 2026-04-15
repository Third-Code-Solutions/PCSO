'use client';

/**
 * Edit form client wrapper.
 * Binds the positionId into the updatePlantillaPosition server action.
 */

import { PlantillaForm } from '@/components/plantilla/plantilla-form';
import { updatePlantillaPosition } from '../../actions';
import type { PlantillaPositionInput } from '@/lib/validations/plantilla';
import type { OfficeRow } from '../../queries';

interface EditPlantillaFormProps {
  positionId: string;
  defaultValues: Partial<PlantillaPositionInput> & { id?: string };
  offices: Pick<OfficeRow, 'id' | 'name' | 'code'>[];
}

export function EditPlantillaForm({
  positionId,
  defaultValues,
  offices,
}: EditPlantillaFormProps) {
  async function handleUpdate(data: PlantillaPositionInput) {
    await updatePlantillaPosition({ id: positionId, ...data });
  }

  return (
    <PlantillaForm
      defaultValues={defaultValues}
      offices={offices}
      action={handleUpdate}
      isEdit
    />
  );
}
