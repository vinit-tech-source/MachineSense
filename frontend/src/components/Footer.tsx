import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="footer" role="contentinfo">
      <span>
        MachineSense &mdash; Machine Health Console &copy; {new Date().getFullYear()} MachineSense
      </span>
      <div className="flex gap-4">
        <Link to="/privacy" id="footer-privacy">Privacy Policy</Link>
        <Link to="/terms" id="footer-terms">Terms &amp; Conditions</Link>
      </div>
    </footer>
  );
}
