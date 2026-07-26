import { AuroraSurface } from "~/components/profile-view";

// QA-only view: renders the aurora surface inside a fixed 16:9 box so it can be
// screenshotted faithfully at the reference's aspect ratio (the full-viewport
// version can't be captured reliably in the preview pane at resized sizes).
export const dynamic = "force-static";

export default function TestAuroraFramePage() {
  return (
    <div className="w-full p-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-md">
        <AuroraSurface color="#e6e6e6" baseColor="#000000" speed={5} />
      </div>
    </div>
  );
}
