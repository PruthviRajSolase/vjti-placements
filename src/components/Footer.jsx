import { Link } from "react-router-dom";
import { useContent } from "../ContentContext.jsx";

function Footer() {
  const { content } = useContent();
  const isLaunch = content?.mode === "launch";

  return (
    <footer className="site-footer">
      {isLaunch ? (
        <>
          <p>
            <strong>VJTI Placements</strong> — Student-run project, not an official TPO website.
            Experiences are shared by students and reviewed before publishing.
          </p>
          <p><Link to="/guidelines">Community guidelines</Link></p>
        </>
      ) : (
        <>
          <p>
            <strong>VJTI Placements</strong> — an unofficial, student-run project.
            Numbers and write-ups shown are sample data for this demo — staff-editable, not official TPO records.
          </p>
          <p>Made with ♥ by VJTI students · Inspired by college placement trackers</p>
        </>
      )}
    </footer>
  );
}

export default Footer;
