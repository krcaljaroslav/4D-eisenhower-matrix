import { describe, expect, it, beforeEach } from 'vitest';
// Mock se importuje přímo: `tsc` vidí reálné typy Obsidianu, alias na mock má
// jen vitest, takže test musí sáhnout na testovací třídy jménem souboru.
import { Setting, type ButtonComponent } from './mocks/obsidian.ts';
import { ConfirmModal, confirmDialog } from '../src/obsidian-adapter/ConfirmModal.ts';

type TestModal = ConfirmModal & { forceCloseAgain: () => void };

const app = {} as never;

function buttons(): ButtonComponent[] {
  const setting = Setting.instances.at(-1);
  if (!setting) throw new Error('Modal nevytvořil žádný Setting');
  return setting.buttons;
}

describe('ConfirmModal', () => {
  beforeEach(() => {
    Setting.instances.length = 0;
  });

  it('potvrzení dá true právě jednou, i když onClose přijde podruhé', () => {
    const decisions: boolean[] = [];
    const modal = new ConfirmModal(app, 'Opravdu?', 'Reset', (confirmed) =>
      decisions.push(confirmed),
    ) as TestModal;

    modal.open();
    buttons()[0]?.click();
    modal.forceCloseAgain();

    expect(decisions).toEqual([true]);
  });

  it('zavření bez potvrzení dá false, opakované zavření nic nepřidá', () => {
    const decisions: boolean[] = [];
    const modal = new ConfirmModal(app, 'Opravdu?', 'Reset', (confirmed) =>
      decisions.push(confirmed),
    ) as TestModal;

    modal.open();
    modal.close();
    modal.forceCloseAgain();

    expect(decisions).toEqual([false]);
  });

  it('Cancel dá false, ne true', () => {
    const decisions: boolean[] = [];
    const modal = new ConfirmModal(app, 'Opravdu?', 'Reset', (confirmed) =>
      decisions.push(confirmed),
    );

    modal.open();
    buttons()[1]?.click();

    expect(decisions).toEqual([false]);
  });

  it('confirmDialog resolvuje podle rozhodnutí', async () => {
    const pending = confirmDialog(app, 'Opravdu?', 'Reset');
    buttons()[0]?.click();
    await expect(pending).resolves.toBe(true);
  });
});
