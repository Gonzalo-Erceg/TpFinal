import { Component } from '@angular/core';
import { Navbar } from './components/navbar/navbar';
import { Hero } from './components/hero/hero';
import { Features } from './components/features/features';
import { Profiles } from './components/profiles/profiles';
import { Process } from './components/process/process';
import { Faq } from './components/faq/faq';
import { Footer } from './components/footer/footer';
@Component({
  selector: 'app-landing',
  imports: [Navbar, Hero, Features, Profiles, Process, Faq, Footer],
  styleUrl: './landing.scss',
  templateUrl: './landing.html',
})
export class Landing {}
